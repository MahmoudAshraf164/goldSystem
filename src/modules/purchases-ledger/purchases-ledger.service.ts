import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Expense } from '../expenses/schemas/expense.schema';
import { ScrapInvoice } from '../scrap-invoices/schemas/scrap-invoice.schema';
import {
  BullionPurchase,
  BullionPurchaseStatus,
} from '../bullion-purchases/schemas/bullion-purchase.schema';
import { PurchasesQueryDto } from './dto/purchases-query.dto';

@Injectable()
export class PurchasesLedgerService {
  constructor(
    @InjectModel(Expense.name)
    private readonly expenseModel: Model<Expense>,
    @InjectModel(ScrapInvoice.name)
    private readonly scrapInvoiceModel: Model<ScrapInvoice>,
    @InjectModel(BullionPurchase.name)
    private readonly bullionPurchaseModel: Model<BullionPurchase>,
  ) {}

  async getOutflowsReport(query: PurchasesQueryDto) {
    const { start, end } = this.calculateDateRange(query);

    // 1. تجميع المصاريف الإدارية والعمومية (المقشة، الصيانة، الرواتب، الخ)
    const expensesAgg = await this.expenseModel.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: '$category',
          totalCash: { $sum: '$amount' },
        },
      },
    ]);

    const shopExpenses =
      expensesAgg.find((r) => r._id === 'SHOP_EXPENSES')?.totalCash || 0;
    const goldExpenses =
      expensesAgg.find((r) => r._id === 'GOLD_PURCHASE')?.totalCash || 0;
    const salaries =
      expensesAgg.find((r) => r._id === 'SALARIES')?.totalCash || 0;
    const otherExpenses =
      expensesAgg.find((r) => r._id === 'OTHERS')?.totalCash || 0;

    const totalGeneralExpenses =
      shopExpenses + goldExpenses + salaries + otherExpenses;

    // 2. تجميع مدفوعات شراء الذهب الكسر من العملاء
    const scrapPurchasesAgg = await this.scrapInvoiceModel.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: null,
          totalCashPaid: { $sum: '$totalPrice' },
          totalWeight: { $sum: '$weight' },
        },
      },
    ]);

    const scrapGoldCash = scrapPurchasesAgg[0]?.totalCashPaid || 0;
    const scrapGoldWeight = scrapPurchasesAgg[0]?.totalWeight || 0;

    // 3. تجميع مدفوعات شراء/مرتجعات السبايك والجنيهات من العملاء
    const bullionPurchasesAgg = await this.bullionPurchaseModel.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          status: BullionPurchaseStatus.COMPLETED,
        },
      },
      {
        $group: {
          _id: null,
          totalCashPaid: { $sum: '$grandTotal' },
          totalCashbackPaid: { $sum: '$totalCashbackPaid' },
          totalGoldWeight: { $sum: '$totalGoldWeight' },
        },
      },
    ]);

    const bullionPurchasesCash = bullionPurchasesAgg[0]?.totalCashPaid || 0;
    const bullionCashbackPaid = bullionPurchasesAgg[0]?.totalCashbackPaid || 0;
    const bullionGoldWeight = bullionPurchasesAgg[0]?.totalGoldWeight || 0;

    // 4. إجمالي الخوارج والمدفوعات الكلية من الخزنة
    const totalOutflowsPrice = parseFloat(
      (totalGeneralExpenses + scrapGoldCash + bullionPurchasesCash).toFixed(2),
    );

    return {
      reportPeriod: { startDate: start, endDate: end },

      // تفنيط مصاريف المحل والتشغيل
      generalExpenses: {
        shopExpensesCash: shopExpenses,
        salariesCash: salaries,
        otherExpensesCash: otherExpenses,
        directGoldExpenseCash: goldExpenses,
        totalGeneralExpenses: parseFloat(totalGeneralExpenses.toFixed(2)),
      },

      // تفنيط مشتريات الذهب والسبايك الكاش
      goldPurchasesBreakdown: {
        scrapGold: {
          totalCashPaid: scrapGoldCash,
          totalWeightGram: parseFloat(scrapGoldWeight.toFixed(3)),
        },
        bullionPurchases: {
          totalCashPaid: bullionPurchasesCash,
          totalCashbackPaid: bullionCashbackPaid,
          totalWeightGram: parseFloat(bullionGoldWeight.toFixed(3)),
        },
        totalGoldPurchasesCash: parseFloat(
          (scrapGoldCash + bullionPurchasesCash).toFixed(2),
        ),
      },

      // إجمالي الخوارج النقدية الكلية
      totalOutflowsPrice,
    };
  }

  // ─── دالة حساب النطاق الزمني بتوقيت القاهرة المقاوم لـ UTC ───
  private calculateDateRange(query: PurchasesQueryDto): {
    start: Date;
    end: Date;
  } {
    const EGYPT_OFFSET = 3 * 60 * 60 * 1000; // +3 ساعات

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
        case 'LAST_3_DAYS':
          localStart.setDate(localStart.getDate() - 3);
          break;
        case 'WEEKLY':
          localStart.setDate(localStart.getDate() - 7);
          break;
        case 'MONTHLY':
          localStart.setMonth(localStart.getMonth() - 1);
          break;
        case 'YEARLY':
          localStart.setFullYear(localStart.getFullYear() - 1);
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
