import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Invoice } from '../sales/schemas/invoice.schema';
import { ScrapInvoice } from '../scrap-invoices/schemas/scrap-invoice.schema';
import { Income } from '../income/schemas/income.schema';
import { Expense } from '../expenses/schemas/expense.schema';
import { BullionSale } from '../bullion-sales/schemas/bullion-sale.schema';
import { BarcodeInvoice } from '../barcode-sales/schemas/barcode-invoice.schema';

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
    // 1. حساب الكاش من جميع المصادر
    const newGoldCash = await this.getCash(
      this.newInvoiceModel,
      start,
      end,
      'COMPLETED',
    );
    const barcodeGoldCash = await this.getBarcodeCash(start, end); // 👈 تم تخصيص دالة محددة بحقول الباركود Corrected
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
    const expenses = await this.getCash(this.expenseModel, start, end);

    // إجمالي الكاش الوارد
    const totalInflow = parseFloat(
      (
        newGoldCash +
        barcodeGoldCash +
        bullionGoldCash +
        scrapGoldCash +
        extraIncomes
      ).toFixed(2),
    );
    const netCashflow = parseFloat((totalInflow - expenses).toFixed(2));

    // 2. حساب أوزان جرامات المشغولات والباركود والسبايك
    const weights = await this.getWeights(start, end);

    return {
      period: { start, end },
      financials: {
        newGoldSalesCash: newGoldCash,
        barcodeGoldSalesCash: barcodeGoldCash,
        bullionGoldSalesCash: bullionGoldCash,
        scrapGoldSalesCash: scrapGoldCash,
        extraIncomesCash: extraIncomes,
        expensesOutflow: expenses,
        totalInflow: totalInflow,
        netCashflow: netCashflow,
      },
      goldWeights: weights,
    };
  }

  // دالة مخصصة لاحتساب كاش فواتير الباركود بناء على finalPaidAmount و isCancelled
  private async getBarcodeCash(start: Date, end: Date): Promise<number> {
    const result = await this.barcodeInvoiceModel.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          isCancelled: { $ne: true }, // استبعاد الفواتير الملغاة
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$finalPaidAmount' }, // 👈 استخدام finalPaidAmount الصحيح
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
    // 1. تقرير المشغولات الذهبية الجديدة المجمعة
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

    // 2. تقرير مبيعات قطع الباركود التجزئة (تحديث التصفية والحقول)
    const barcodeGoldReport = await this.barcodeInvoiceModel.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          isCancelled: { $ne: true }, // 👈 استبدال status بـ isCancelled
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.karat',
          totalWeight: { $sum: '$items.netWeight' }, // 👈 استخدام netWeight بدلاً من weight
        },
      },
    ]);

    // 3. تقرير مبيعات السبايك والجنيهات
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

    // 4. تقرير الذهب الكسر
    const scrapGoldReport = await this.scrapInvoiceModel.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          $or: [
            { status: 'COMPLETED' },
            { status: { $exists: false } },
            { status: 'completed' },
          ],
        },
      },
      { $group: { _id: '$karat', totalWeight: { $sum: '$weight' } } },
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
        karat24: parseFloat(getWeightByKarat(scrapGoldReport, 24).toFixed(3)),
        karat21: parseFloat(getWeightByKarat(scrapGoldReport, 21).toFixed(3)),
        karat18: parseFloat(getWeightByKarat(scrapGoldReport, 18).toFixed(3)),
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

    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(todayEnd);
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);

    const last7DaysStart = new Date(todayStart);
    last7DaysStart.setDate(last7DaysStart.getDate() - 7);

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
