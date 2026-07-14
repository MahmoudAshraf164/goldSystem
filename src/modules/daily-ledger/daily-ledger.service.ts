import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Invoice } from '../sales/schemas/invoice.schema';
import { ScrapInvoice } from '../scrap-invoices/schemas/scrap-invoice.schema';
import { LedgerQueryDto } from './dto/ledger-query.dto';

@Injectable()
export class DailyLedgerService {
  constructor(
    @InjectModel(Invoice.name) private readonly newInvoiceModel: Model<Invoice>,
    @InjectModel(ScrapInvoice.name)
    private readonly scrapInvoiceModel: Model<ScrapInvoice>,
  ) {}

  async getLedgerReport(query: LedgerQueryDto) {
    const { start, end } = this.calculateDateRange(query);

    // 1. حساب تقارير الذهب الجديد (النقدية + الجرامات مفنطة بالعيار)
    const newGoldReport = await this.newInvoiceModel.aggregate([
      {
        $match: { createdAt: { $gte: start, $lte: end }, status: 'COMPLETED' },
      },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'inventories', // اسم كولكشن الـ Inventory في الداتا بيز
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

    const newGoldCash = await this.newInvoiceModel.aggregate([
      {
        $match: { createdAt: { $gte: start, $lte: end }, status: 'COMPLETED' },
      },
      { $group: { _id: null, totalCash: { $sum: '$totalPrice' } } },
    ]);

    // 2. حساب تقارير الذهب الكسر (النقدية + الجرامات مفنطة بالعيار)
    const scrapGoldReport = await this.scrapInvoiceModel.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: '$karat',
          totalWeight: { $sum: '$weight' },
          totalCash: { $sum: '$totalPrice' },
        },
      },
    ]);

    // 3. ترتيب وتفنيط البيانات الخارجة بلغة السوق (عيار 21 وعيار 18)
    const formattedNewGold = {
      totalCash: newGoldCash[0]?.totalCash || 0,
      karat21_Gram: newGoldReport.find((r) => r._id === 21)?.totalWeight || 0,
      karat18_Gram: newGoldReport.find((r) => r._id === 18)?.totalWeight || 0,
    };

    const formattedScrapGold = {
      totalCash: scrapGoldReport.reduce((acc, r) => acc + r.totalCash, 0),
      karat21_Gram: scrapGoldReport.find((r) => r._id === 21)?.totalWeight || 0,
      karat18_Gram: scrapGoldReport.find((r) => r._id === 18)?.totalWeight || 0,
    };

    // 4. الحسبة النهائية الكبرى (الخزنة الكلية اليومية أو الجرد المحدد)
    const totalDailyCashflow = parseFloat(
      (formattedNewGold.totalCash + formattedScrapGold.totalCash).toFixed(2),
    );

    return {
      reportPeriod: { startDate: start, endDate: end },
      newGoldSales: formattedNewGold,
      scrapGoldSales: formattedScrapGold,
      totalDailyCashflow, // الـ مليون وربع مجموع الكاشين
    };
  }

  // دالة ذكية لاحتساب الفترات الزمنية يدوياً أو بناءً على الـ Presets
  private calculateDateRange(query: LedgerQueryDto): {
    start: Date;
    end: Date;
  } {
    const EGYPT_OFFSET = 3 * 60 * 60 * 1000; // فارق توقيت مصر عن جرينتش بالملي ثانية (+3 ساعات)

    // 1. حساب التاريخ الحالي الفعلي داخل المحل بتوقيت القاهرة المقاوم للـ UTC
    const cairoDateStr = new Date().toLocaleString('en-US', {
      timeZone: 'Africa/Cairo',
    });
    const nowLocal = new Date(cairoDateStr);

    // قيم افتراضية لليوم الحالي (بالتوقيت المحلي للمحل)
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

    // 2. في حالة قيام الفرونت إند ببعث تاريخ مخصص من الكاليندر
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
      // 3. التعامل الصارم مع الفلاتر الجاهزة (Presets) بناءً على الأيام المحلية
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
          // محددة سلفاً بأول وآخره لليوم المحلي الفعلي للمحل
          break;
      }
    }

    // 4. 🚨 موازنة الاستعلام ليتناسب مع صيغة UTC المخزنة في MongoDB
    // بنطرح الـ 3 ساعات عشان نطابق الفواتير والحركات اللي دخلت بعد منتصف الليل صح
    const start = new Date(localStart.getTime() - EGYPT_OFFSET);
    const end = new Date(localEnd.getTime() - EGYPT_OFFSET);

    return { start, end };
  }
}
