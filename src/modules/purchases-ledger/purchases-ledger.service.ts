import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Expense } from '../expenses/schemas/expense.schema';
import { ScrapPurchase } from '../scrap-purchases/schemas/scrap-purchases.schema'; // 👈 استيراد الموديل
import { PurchasesQueryDto } from './dto/purchases-query.dto';

@Injectable()
export class PurchasesLedgerService {
  constructor(
    @InjectModel(Expense.name) private readonly expenseModel: Model<Expense>,
    @InjectModel(ScrapPurchase.name)
    private readonly scrapPurchaseModel: Model<ScrapPurchase>, // 👈 حقن موديل مشتريات الكسر
  ) {}

  async getOutflowsReport(query: PurchasesQueryDto) {
    const { start, end } = this.calculateDateRange(query);

    // 1. تجميع الخوارج من جدول المصاريف (مصاريف المحل، الرواتب، إلخ)
    const allExpenses = await this.expenseModel.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: '$category',
          totalCash: { $sum: '$amount' },
        },
      },
    ]);

    // تفنيط المصاريف العادية
    const shopExpenses =
      allExpenses.find((r) => r._id === 'SHOP_EXPENSES')?.totalCash || 0; // تكاليف المحل
    const goldPurchasesExpense =
      allExpenses.find((r) => r._id === 'GOLD_PURCHASE')?.totalCash || 0; // شراء ذهب مسجل بالمصاريف (إن وجد)
    const salaries =
      allExpenses.find((r) => r._id === 'SALARIES')?.totalCash || 0;
    const others = allExpenses.find((r) => r._id === 'OTHERS')?.totalCash || 0;

    // 2. تجميع مشتريات الذهب الكسر الفعلية المباشرة من ScrapPurchase (كاش + أوزان)
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

    // إجمالي كاش مشتريات الذهب الكسر
    const scrapGoldPurchasesCash = scrapPurchasesData.reduce(
      (sum, item) => sum + item.totalCash,
      0,
    );

    // تفصيل أوزان الذهب الكسر المشتراة حسب العيار
    const scrapPurchasedGrams = {
      karat21:
        scrapPurchasesData.find((item) => item._id === 21)?.totalWeight || 0,
      karat18:
        scrapPurchasesData.find((item) => item._id === 18)?.totalWeight || 0,
      karat24:
        scrapPurchasesData.find((item) => item._id === 24)?.totalWeight || 0,
    };

    // إجمالي مشتريات الذهب النقدي (شراء الكسر المباشر + أي شراء مسجل بالمصاريف)
    const totalGoldPurchasesCash =
      goldPurchasesExpense + scrapGoldPurchasesCash;

    // مجموع الفلوس الخارجة من السيستم بالكامل
    const totalOutflowsPrice = parseFloat(
      (shopExpenses + totalGoldPurchasesCash + salaries + others).toFixed(2),
    );

    return {
      reportPeriod: { startDate: start, endDate: end },
      outflowsBreakdown: {
        pettyExpensesCash: shopExpenses, // تكاليف المحل التشغيلية
        goldPurchasesCash: totalGoldPurchasesCash, // إجمالي مشتريات الذهب النقدي
        scrapGoldPurchasesCash: scrapGoldPurchasesCash, // 👈 بند خاص ومستقل لمشتريات الكسر
        salariesCash: salaries, // المرتبات
        othersCash: others, // نثريات أخرى
      },
      scrapPurchasedGrams, // 👈 أوزان جرامات الكسر المشتراه بالتفصيل
      totalOutflowsPrice, // إجمالي السيولة النقدية الخارجة
    };
  }

  private calculateDateRange(query: PurchasesQueryDto): {
    start: Date;
    end: Date;
  } {
    const EGYPT_OFFSET = 3 * 60 * 60 * 1000; // فارق توقيت مصر عن جرينتش بالملي ثانية (+3 ساعات)

    // 1. حساب التاريخ الحالي الفعلي بتوقيت مصر
    const cairoDateStr = new Date().toLocaleString('en-US', {
      timeZone: 'Africa/Cairo',
    });
    const nowLocal = new Date(cairoDateStr);

    // قيم افتراضية لليوم الحالي (بالتوقيت المحلي)
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

    // 2. في حالة إرسال تاريخ مخصص من الكاليندر (الفرونت إند)
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
      // 3. التعامل مع الفلاتر الصافية والمحددة
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

    // 4. تحويل النطاق المحلي الصارم إلى ما يقابله في UTC للداتابيز
    const start = new Date(localStart.getTime() - EGYPT_OFFSET);
    const end = new Date(localEnd.getTime() - EGYPT_OFFSET);

    return { start, end };
  }
}
