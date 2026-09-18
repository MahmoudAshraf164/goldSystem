import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Expense } from '../expenses/schemas/expense.schema';
import { ScrapPurchase } from '../scrap-purchases/schemas/scrap-purchases.schema';
import { SupplierTransaction } from '../suppliers/schemas/supplier-transaction.schema';
import { PurchasesQueryDto } from './dto/purchases-query.dto';

@Injectable()
export class PurchasesLedgerService {
  constructor(
    @InjectModel(Expense.name) private readonly expenseModel: Model<Expense>,
    @InjectModel(ScrapPurchase.name)
    private readonly scrapPurchaseModel: Model<ScrapPurchase>,
    @InjectModel(SupplierTransaction.name)
    private readonly supplierTransactionModel: Model<SupplierTransaction>,
  ) {}

  async getOutflowsReport(query: PurchasesQueryDto) {
    const { start, end } = this.calculateDateRange(query);

    const allExpenses = await this.expenseModel.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: '$category',
          totalCash: { $sum: '$amount' },
        },
      },
    ]);

    const shopExpenses =
      allExpenses.find((r) => r._id === 'SHOP_EXPENSES')?.totalCash || 0;
    const goldPurchasesExpense =
      allExpenses.find((r) => r._id === 'GOLD_PURCHASE')?.totalCash || 0;
    const salaries =
      allExpenses.find((r) => r._id === 'SALARIES')?.totalCash || 0;
    const others = allExpenses.find((r) => r._id === 'OTHERS')?.totalCash || 0;

    const scrapPurchasesData = await this.scrapPurchaseModel.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: '$karat',
          totalCash: { $sum: '$totalPrice' },
          totalWeight: { $sum: '$weight' },
        },
      },
    ]);

    const scrapGoldPurchasesCash = scrapPurchasesData.reduce(
      (sum, item) => sum + item.totalCash,
      0,
    );

    const scrapPurchasedGrams = {
      karat21:
        scrapPurchasesData.find((item) => item._id === 21)?.totalWeight || 0,
      karat18:
        scrapPurchasesData.find((item) => item._id === 18)?.totalWeight || 0,
      karat24:
        scrapPurchasesData.find((item) => item._id === 24)?.totalWeight || 0,
    };

    const totalGoldPurchasesCash =
      goldPurchasesExpense + scrapGoldPurchasesCash;

    const supplierPaymentsData = await this.supplierTransactionModel.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: null,
          totalCashPaid: { $sum: '$paymentDetails.cashPaid' },
          totalFeePaid: { $sum: '$paymentDetails.manufacturingFeePaid' },
        },
      },
    ]);

    const supplierPaymentsCash =
      (supplierPaymentsData[0]?.totalCashPaid || 0) +
      (supplierPaymentsData[0]?.totalFeePaid || 0);

    const totalOutflowsPrice = parseFloat(
      (
        shopExpenses +
        totalGoldPurchasesCash +
        salaries +
        others +
        supplierPaymentsCash
      ).toFixed(2),
    );

    return {
      reportPeriod: { startDate: start, endDate: end },
      outflowsBreakdown: {
        pettyExpensesCash: shopExpenses,
        goldPurchasesCash: totalGoldPurchasesCash,
        scrapGoldPurchasesCash: scrapGoldPurchasesCash,
        supplierPaymentsCash: supplierPaymentsCash,
        salariesCash: salaries,
        othersCash: others,
      },
      scrapPurchasedGrams,
      totalOutflowsPrice,
    };
  }

  private calculateDateRange(query: PurchasesQueryDto): {
    start: Date;
    end: Date;
  } {
    const EGYPT_OFFSET = 3 * 60 * 60 * 1000;
    const cairoDateStr = new Date().toLocaleString('en-US', {
      timeZone: 'Africa/Cairo',
    });
    const nowLocal = new Date(cairoDateStr);

    let localStart = new Date(
      nowLocal.getFullYear(),
      nowLocal.getMonth(),
      nowLocal.getDate(),
      0,
      0,
      0,
      0,
    );
    let localEnd = new Date(
      nowLocal.getFullYear(),
      nowLocal.getMonth(),
      nowLocal.getDate(),
      23,
      59,
      59,
      999,
    );

    if (query.startDate) {
      const parsedStart = new Date(query.startDate);
      localStart = new Date(
        parsedStart.getFullYear(),
        parsedStart.getMonth(),
        parsedStart.getDate(),
        0,
        0,
        0,
        0,
      );

      if (query.endDate) {
        const parsedEnd = new Date(query.endDate);
        localEnd = new Date(
          parsedEnd.getFullYear(),
          parsedEnd.getMonth(),
          parsedEnd.getDate(),
          23,
          59,
          59,
          999,
        );
      } else {
        localEnd = new Date(
          parsedStart.getFullYear(),
          parsedStart.getMonth(),
          parsedStart.getDate(),
          23,
          59,
          59,
          999,
        );
      }
    } else {
      switch (query.preset) {
        case 'YESTERDAY':
          localStart.setDate(localStart.getDate() - 1);
          localEnd.setDate(localEnd.getDate() - 1);
          break;
        case 'WEEKLY':
          localStart.setDate(localStart.getDate() - 7);
          break;
        case 'MONTHLY':
          localStart.setMonth(localStart.getMonth() - 1);
          break;
        case 'TODAY':
        default:
          break;
      }
    }

    const start = new Date(localStart.getTime() - EGYPT_OFFSET);
    const end = new Date(localEnd.getTime() - EGYPT_OFFSET);

    return { start, end };
  }
}
