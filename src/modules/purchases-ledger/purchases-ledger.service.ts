import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Expense } from '../expenses/schemas/expense.schema';
import { PurchasesQueryDto } from './dto/purchases-query.dto';

@Injectable()
export class PurchasesLedgerService {
  constructor(
    @InjectModel(Expense.name) private readonly expenseModel: Model<Expense>,
  ) {}

  async getOutflowsReport(query: PurchasesQueryDto) {
    const { start, end } = this.calculateDateRange(query);

    // تجميع الخوارج كلها من الدفتر
    const allOutflows = await this.expenseModel.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: '$category',
          totalCash: { $sum: '$amount' },
        },
      },
    ]);

    // تفنيط المخرجات ببساطة
    const shopExpenses =
      allOutflows.find((r) => r._id === 'SHOP_EXPENSES')?.totalCash || 0; // تكاليف المحل (المقشة)
    const goldPurchases =
      allOutflows.find((r) => r._id === 'GOLD_PURCHASE')?.totalCash || 0; // شراء الذهب (زبون أو جملة)
    const salaries =
      allOutflows.find((r) => r._id === 'SALARIES')?.totalCash || 0;
    const others = allOutflows.find((r) => r._id === 'OTHERS')?.totalCash || 0;

    // مجموع الفلوس اللي خرجت من السيستم بالكامل
    const totalOutflowsPrice = parseFloat(
      (shopExpenses + goldPurchases + salaries + others).toFixed(2),
    );

    return {
      reportPeriod: { startDate: start, endDate: end },
      outflowsBreakdown: {
        pettyExpensesCash: shopExpenses, // تكاليف المحل العادية
        goldPurchasesCash: goldPurchases, // مشتريات الذهب
        salariesCash: salaries,
        othersCash: others,
      },
      totalOutflowsPrice, // إجمالي الخارج المالي الفعلي
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
      // 3. التعامل مع الفلاتر الصافية والمحددة فقط بناءً على طلبك
      switch (query.preset) {
        case 'YESTERDAY': // فلتر أمس: من بداية أمس لنهايته تماماً
          localStart.setDate(localStart.getDate() - 1);
          localEnd.setDate(localEnd.getDate() - 1);
          break;
        case 'WEEKLY': // فلتر أسبوع فات: من 7 أيام مضت حتى نهاية اليوم الحالي
          localStart.setDate(localStart.getDate() - 7);
          break;
        case 'MONTHLY': // فلتر شهر فات: من شهر مضى حتى نهاية اليوم الحالي
          localStart.setMonth(localStart.getMonth() - 1);
          break;
        case 'TODAY':
        default:
          // يظل على قيم اليوم الافتراضية
          break;
      }
    }

    // 4. تحويل النطاق المحلي الصارم إلى ما يقابله في UTC للداتابيز
    const start = new Date(localStart.getTime() - EGYPT_OFFSET);
    const end = new Date(localEnd.getTime() - EGYPT_OFFSET);

    return { start, end };
  }
}
