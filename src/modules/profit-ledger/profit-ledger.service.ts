import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Invoice } from '../sales/schemas/invoice.schema';
import { ScrapInvoice } from '../scrap-invoices/schemas/scrap-invoice.schema';
import { Expense } from '../expenses/schemas/expense.schema';
import { LedgerQueryDto } from '../daily-ledger/dto/ledger-query.dto';

@Injectable()
export class ProfitLedgerService {
  constructor(
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<Invoice>,
    @InjectModel(ScrapInvoice.name)
    private readonly scrapInvoiceModel: Model<ScrapInvoice>,
    @InjectModel(Expense.name) private readonly expenseModel: Model<Expense>,
  ) {}

  async getAdvancedProfitReport(query: LedgerQueryDto) {
    const { start, end } = this.calculateDateRange(query);

    // ─── 1. حساب النقدية الداخلة للمحل (Inflows) ───
    const newGoldCashData = await this.invoiceModel.aggregate([
      {
        $match: { createdAt: { $gte: start, $lte: end }, status: 'COMPLETED' },
      },
      { $group: { _id: null, totalCash: { $sum: '$totalPrice' } } },
    ]);
    const newGoldCash = newGoldCashData[0]?.totalCash || 0;

    const scrapSalesData = await this.scrapInvoiceModel.aggregate([
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
      { $group: { _id: null, totalSalesCash: { $sum: '$totalPrice' } } },
    ]);
    const scrapSalesCash = scrapSalesData[0]?.totalSalesCash || 0;

    // إجمالي الكاش الداخل (جديد + كسر)
    const totalCashInflow = parseFloat(
      (newGoldCash + scrapSalesCash).toFixed(2),
    );

    // ─── 2. حساب النقدية الخارجة بالكامل من الدرج (Outflows) ───
    const operatingExpensesData = await this.expenseModel.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          category: { $ne: 'GOLD_PURCHASE' },
        },
      },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
    ]);
    const shopExpenses =
      operatingExpensesData.find((e) => e._id === 'SHOP_EXPENSES')?.total || 0;
    const salaries =
      operatingExpensesData.find((e) => e._id === 'SALARIES')?.total || 0;
    const others =
      operatingExpensesData.find((e) => e._id === 'OTHERS')?.total || 0;
    const totalOperatingExpenses = parseFloat(
      (shopExpenses + salaries + others).toFixed(2),
    );

    const scrapPurchasesData = await this.expenseModel.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          category: 'GOLD_PURCHASE',
        },
      },
      { $group: { _id: null, totalCostCash: { $sum: '$amount' } } },
    ]);
    const scrapGoldPurchasesCost = scrapPurchasesData[0]?.totalCostCash || 0;

    // إجمالي الكاش الخارج
    const totalCashOutflow = parseFloat(
      (totalOperatingExpenses + scrapGoldPurchasesCost).toFixed(2),
    );

    // ─── 3. صافي كاش الدرج المتبقي (قفل الخزنة الفعلي) ───
    const netCashInDrawer = parseFloat(
      (totalCashInflow - totalCashOutflow).toFixed(2),
    );

    // ─── 4. 🛠️ التفنيط التحليلي لأرباح المصنعيات (جديد + كسر) ───
    // أ- أرباح مصنعيات الذهب الجديد
    const newGoldProfitData = await this.invoiceModel.aggregate([
      {
        $match: { createdAt: { $gte: start, $lte: end }, status: 'COMPLETED' },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: null,
          totalMakingChargesProfit: {
            $sum: {
              $multiply: [
                '$items.soldNetWeight',
                '$items.makingChargesPerGram',
              ],
            },
          },
        },
      },
    ]);
    const newGoldMakingProfit =
      newGoldProfitData[0]?.totalMakingChargesProfit || 0;

    // ب- 🛠️ حساب أرباح مصنعيات الذهب الكسر (الوزن × مصنعية الكسر المدخلة بالفاتورة)
    const scrapGoldProfitData = await this.scrapInvoiceModel.aggregate([
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
      {
        $group: {
          _id: null,
          totalScrapMakingProfit: {
            $sum: { $multiply: ['$weight', '$makingChargesPerGram'] }, // 👈 ضرب الوزن في مصنعية الكسر
          },
        },
      },
    ]);
    const scrapGoldMakingProfit =
      scrapGoldProfitData[0]?.totalScrapMakingProfit || 0;

    // ج- إجمالي أرباح المصنعيات الكلية للمحل (جديد + كسر)
    const totalCombinedMakingProfit = parseFloat(
      (newGoldMakingProfit + scrapGoldMakingProfit).toFixed(2),
    );

    let healthIndicator = 'الدرج متقفل وموزون بنجاح تام وعال العال 🚀';
    if (netCashInDrawer < 0)
      healthIndicator =
        'تحذير: عجز نقدية مؤقت بالخزنة (المصاريف أعلى من الداخل) ⚠️';

    return {
      reportPeriod: { startDate: start, endDate: end },
      cashflowHighlights: {
        totalCashInflow,
        totalCashOutflow,
      },
      outflowsDetailedBreakdown: {
        pettyExpensesCash: shopExpenses,
        salariesCash: salaries,
        goldPurchasesCash: scrapGoldPurchasesCost,
        otherExpensesCash: others,
      },
      finalNetProfit: netCashInDrawer, // صافي الكاش الفعلي بالدرج
      advancedAnalyticalBreakdown: {
        newGoldMakingChargesProfit: parseFloat(newGoldMakingProfit.toFixed(2)), // ربح مصنعية الجديد لوحده
        scrapGoldMakingChargesProfit: parseFloat(
          scrapGoldMakingProfit.toFixed(2),
        ), // 👈 ربح مصنعية الكسر لوحده
        totalCombinedMakingProfit, // إجمالي أرباح المصنعيات للاثنين
        performanceIndicator: healthIndicator,
      },
    };
  }

  private calculateDateRange(query: LedgerQueryDto): {
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

    return {
      start: new Date(localStart.getTime() - EGYPT_OFFSET),
      end: new Date(localEnd.getTime() - EGYPT_OFFSET),
    };
  }
}
