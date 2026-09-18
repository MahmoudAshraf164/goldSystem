import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Invoice } from '../sales/schemas/invoice.schema';
import { ScrapInvoice } from '../scrap-invoices/schemas/scrap-invoice.schema';
import { Income } from '../income/schemas/income.schema';
import { Expense } from '../expenses/schemas/expense.schema';
import { BullionSale } from '../bullion-sales/schemas/bullion-sale.schema';
import { BarcodeInvoice } from '../barcode-sales/schemas/barcode-invoice.schema';
import { ScrapPurchase } from '../scrap-purchases/schemas/scrap-purchases.schema';
import { SupplierTransaction } from '../suppliers/schemas/supplier-transaction.schema';

@Injectable()
export class DailyLedgerService {
  constructor(
    @InjectModel(Invoice.name) private readonly newInvoiceModel: Model<Invoice>,
    @InjectModel(ScrapInvoice.name)
    private readonly scrapInvoiceModel: Model<ScrapInvoice>,
    @InjectModel(Income.name) private readonly incomeModel: Model<Income>,
    @InjectModel(Expense.name) private readonly expenseModel: Model<Expense>,
    @InjectModel(BullionSale.name)
    private readonly bullionSaleModel: Model<BullionSale>,
    @InjectModel(BarcodeInvoice.name)
    private readonly barcodeInvoiceModel: Model<BarcodeInvoice>,
    @InjectModel(ScrapPurchase.name)
    private readonly scrapPurchaseModel: Model<ScrapPurchase>,
    @InjectModel(SupplierTransaction.name)
    private readonly supplierTransactionModel: Model<SupplierTransaction>,
  ) {}

  async getLedgerReport() {
    const ranges = this.getStrictDateRanges();

    const todayData = await this.getDataForRange(
      ranges.today.start,
      ranges.today.end,
    );
    const yesterdayData = await this.getDataForRange(
      ranges.yesterday.start,
      ranges.yesterday.end,
    );
    const last7DaysData = await this.getDataForRange(
      ranges.last7Days.start,
      ranges.last7Days.end,
    );

    return {
      today: todayData,
      yesterday: yesterdayData,
      exactlyOneWeekAgo: last7DaysData,
    };
  }

  private async getDataForRange(start: Date, end: Date) {
    const newGoldCash = await this.getCash(
      this.newInvoiceModel,
      start,
      end,
      'COMPLETED',
    );
    const barcodeGoldCash = await this.getBarcodeCash(start, end);
    const bullionGoldCash = await this.getCash(
      this.bullionSaleModel,
      start,
      end,
      'COMPLETED',
    );
    const scrapGoldCash = await this.getCash(
      this.scrapInvoiceModel,
      start,
      end,
    );
    const extraIncomes = await this.getCash(this.incomeModel, start, end);

    const generalExpenses = await this.getCash(this.expenseModel, start, end);
    const scrapPurchaseCash = await this.getCash(
      this.scrapPurchaseModel,
      start,
      end,
    );
    const supplierPaymentsCash = await this.getSupplierCashOutflow(start, end);

    const totalExpensesOutflow = parseFloat(
      (generalExpenses + scrapPurchaseCash + supplierPaymentsCash).toFixed(2),
    );

    const totalInflow = parseFloat(
      (
        newGoldCash +
        barcodeGoldCash +
        bullionGoldCash +
        scrapGoldCash +
        extraIncomes
      ).toFixed(2),
    );
    const netCashflow = parseFloat(
      (totalInflow - totalExpensesOutflow).toFixed(2),
    );

    const weights = await this.getWeights(start, end);

    return {
      period: { start, end },
      financials: {
        newGoldSalesCash: newGoldCash,
        barcodeGoldSalesCash: barcodeGoldCash,
        bullionGoldSalesCash: bullionGoldCash,
        scrapGoldSalesCash: scrapGoldCash,
        extraIncomesCash: extraIncomes,
        expensesOutflow: totalExpensesOutflow,
        scrapPurchasesOutflow: scrapPurchaseCash,
        supplierPaymentsOutflow: supplierPaymentsCash,
        totalInflow: totalInflow,
        netCashflow: netCashflow,
      },
      goldWeights: weights,
    };
  }

  private async getSupplierCashOutflow(
    start: Date,
    end: Date,
  ): Promise<number> {
    const result = await this.supplierTransactionModel.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: null,
          totalCash: { $sum: '$paymentDetails.cashPaid' },
          totalFees: { $sum: '$paymentDetails.manufacturingFeePaid' },
        },
      },
    ]);
    return (result[0]?.totalCash || 0) + (result[0]?.totalFees || 0);
  }

  private async getBarcodeCash(start: Date, end: Date): Promise<number> {
    const result = await this.barcodeInvoiceModel.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          isCancelled: { $ne: true },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$finalPaidAmount' },
        },
      },
    ]);
    return result[0]?.total || 0;
  }

  private async getCash(
    model: Model<any>,
    start: Date,
    end: Date,
    status?: string,
  ): Promise<number> {
    const matchStage: any = { createdAt: { $gte: start, $lte: end } };
    if (status) {
      matchStage.status = status;
    } else if (model.modelName === 'ScrapInvoice') {
      matchStage.$or = [
        { status: 'COMPLETED' },
        { status: { $exists: false } },
        { status: 'completed' },
      ];
    }

    const result = await model.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          total: {
            $sum:
              model.modelName === 'Expense' || model.modelName === 'Income'
                ? '$amount'
                : model.modelName === 'BullionSale'
                  ? '$grandTotal'
                  : '$totalPrice',
          },
        },
      },
    ]);
    return result[0]?.total || 0;
  }

  private async getWeights(start: Date, end: Date) {
    const newGoldReport = await this.newInvoiceModel.aggregate([
      {
        $match: { createdAt: { $gte: start, $lte: end }, status: 'COMPLETED' },
      },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'inventories',
          localField: 'items.inventoryItem',
          foreignField: '_id',
          as: 'inventoryDetails',
        },
      },
      { $unwind: '$inventoryDetails' },
      {
        $group: {
          _id: '$inventoryDetails.karat',
          totalWeight: { $sum: '$items.soldNetWeight' },
        },
      },
    ]);

    const barcodeGoldReport = await this.barcodeInvoiceModel.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          isCancelled: { $ne: true },
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.karat',
          totalWeight: { $sum: '$items.netWeight' },
        },
      },
    ]);

    const bullionGoldReport = await this.bullionSaleModel.aggregate([
      {
        $match: { createdAt: { $gte: start, $lte: end }, status: 'COMPLETED' },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.karat',
          totalWeight: {
            $sum: { $multiply: ['$items.weightPerUnit', '$items.quantity'] },
          },
        },
      },
    ]);

    const scrapPurchaseReport = await this.scrapPurchaseModel.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: '$karat',
          totalWeight: { $sum: '$weight' },
        },
      },
    ]);

    const getWeightByKarat = (report: any[], karat: number) =>
      report.find((r) => r._id === karat)?.totalWeight || 0;

    return {
      newGoldSalesGrams: {
        karat24: parseFloat(
          (
            getWeightByKarat(newGoldReport, 24) +
            getWeightByKarat(barcodeGoldReport, 24) +
            getWeightByKarat(bullionGoldReport, 24)
          ).toFixed(3),
        ),
        karat21: parseFloat(
          (
            getWeightByKarat(newGoldReport, 21) +
            getWeightByKarat(barcodeGoldReport, 21) +
            getWeightByKarat(bullionGoldReport, 21)
          ).toFixed(3),
        ),
        karat18: parseFloat(
          (
            getWeightByKarat(newGoldReport, 18) +
            getWeightByKarat(barcodeGoldReport, 18)
          ).toFixed(3),
        ),
      },
      scrapGoldPurchasesGrams: {
        karat24: parseFloat(
          getWeightByKarat(scrapPurchaseReport, 24).toFixed(3),
        ),
        karat21: parseFloat(
          getWeightByKarat(scrapPurchaseReport, 21).toFixed(3),
        ),
        karat18: parseFloat(
          getWeightByKarat(scrapPurchaseReport, 18).toFixed(3),
        ),
      },
    };
  }

  private getStrictDateRanges() {
    const EGYPT_OFFSET = 3 * 60 * 60 * 1000;
    const cairoDateStr = new Date().toLocaleString('en-US', {
      timeZone: 'Africa/Cairo',
    });
    const nowLocal = new Date(cairoDateStr);

    const todayStart = new Date(
      nowLocal.getFullYear(),
      nowLocal.getMonth(),
      nowLocal.getDate(),
      0,
      0,
      0,
      0,
    );
    const todayEnd = new Date(
      nowLocal.getFullYear(),
      nowLocal.getMonth(),
      nowLocal.getDate(),
      23,
      59,
      59,
      999,
    );

    const logicStartDate = (base: Date, days: number) => {
      const d = new Date(base);
      d.setDate(d.getDate() - days);
      return d;
    };

    const yesterdayStart = logicStartDate(todayStart, 1);
    const yesterdayEnd = logicStartDate(todayEnd, 1);
    const last7DaysStart = logicStartDate(todayStart, 7);

    return {
      today: {
        start: new Date(todayStart.getTime() - EGYPT_OFFSET),
        end: new Date(todayEnd.getTime() - EGYPT_OFFSET),
      },
      yesterday: {
        start: new Date(yesterdayStart.getTime() - EGYPT_OFFSET),
        end: new Date(yesterdayEnd.getTime() - EGYPT_OFFSET),
      },
      last7Days: {
        start: new Date(last7DaysStart.getTime() - EGYPT_OFFSET),
        end: new Date(yesterdayEnd.getTime() - EGYPT_OFFSET),
      },
    };
  }
}
