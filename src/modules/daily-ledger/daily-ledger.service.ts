import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Invoice } from '../sales/schemas/invoice.schema';
import { ScrapInvoice } from '../scrap-invoices/schemas/scrap-invoice.schema';
import {
  BullionSale,
  BullionSaleStatus,
} from '../bullion-sales/schemas/bullion-sale.schema';
import {
  BullionPurchase,
  BullionPurchaseStatus,
} from '../bullion-purchases/schemas/bullion-purchase.schema';
import { LedgerQueryDto } from './dto/ledger-query.dto';

@Injectable()
export class DailyLedgerService {
  constructor(
    @InjectModel(Invoice.name)
    private readonly newInvoiceModel: Model<Invoice>,
    @InjectModel(ScrapInvoice.name)
    private readonly scrapInvoiceModel: Model<ScrapInvoice>,
    @InjectModel(BullionSale.name)
    private readonly bullionSaleModel: Model<BullionSale>,
    @InjectModel(BullionPurchase.name)
    private readonly bullionPurchaseModel: Model<BullionPurchase>,
  ) {}

  async getLedgerReport(query: LedgerQueryDto) {
    const { start, end } = this.calculateDateRange(query);

    // 1. حساب الذهب الجديد (المشغولات)
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

    const newGoldCash = await this.newInvoiceModel.aggregate([
      {
        $match: { createdAt: { $gte: start, $lte: end }, status: 'COMPLETED' },
      },
      { $group: { _id: null, totalCash: { $sum: '$totalPrice' } } },
    ]);

    const formattedNewGold = {
      totalCashIn: newGoldCash[0]?.totalCash || 0,
      karat21_Gram: newGoldReport.find((r) => r._id === 21)?.totalWeight || 0,
      karat18_Gram: newGoldReport.find((r) => r._id === 18)?.totalWeight || 0,
      karat24_Gram: newGoldReport.find((r) => r._id === 24)?.totalWeight || 0,
    };

    // 2. حساب الذهب الكسر (شراء من العميل - خروج كاش)
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

    const formattedScrapGold = {
      totalCashOut: scrapGoldReport.reduce((acc, r) => acc + r.totalCash, 0),
      karat21_Gram: scrapGoldReport.find((r) => r._id === 21)?.totalWeight || 0,
      karat18_Gram: scrapGoldReport.find((r) => r._id === 18)?.totalWeight || 0,
      karat24_Gram: scrapGoldReport.find((r) => r._id === 24)?.totalWeight || 0,
    };

    // 3. حساب السبايك والجنيهات
    const bullionSalesAgg = await this.bullionSaleModel.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          status: BullionSaleStatus.COMPLETED,
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.karat',
          totalWeight: {
            $sum: { $multiply: ['$items.weightPerUnit', '$items.quantity'] },
          },
          totalCash: { $sum: '$items.itemTotalPrice' },
          totalMakingCharges: {
            $sum: {
              $multiply: ['$items.makingChargePerUnit', '$items.quantity'],
            },
          },
        },
      },
    ]);

    const bullionPurchasesAgg = await this.bullionPurchaseModel.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          status: BullionPurchaseStatus.COMPLETED,
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.karat',
          totalWeight: {
            $sum: { $multiply: ['$items.weightPerUnit', '$items.quantity'] },
          },
          totalCashPaid: { $sum: '$items.itemGrandTotal' },
          totalCashbackPaid: { $sum: '$items.itemTotalCashback' },
        },
      },
    ]);

    const bullionSalesCashIn = bullionSalesAgg.reduce(
      (acc, r) => acc + r.totalCash,
      0,
    );
    const bullionSalesMakingProfit = bullionSalesAgg.reduce(
      (acc, r) => acc + r.totalMakingCharges,
      0,
    );

    const bullionPurchasesCashOut = bullionPurchasesAgg.reduce(
      (acc, r) => acc + r.totalCashPaid,
      0,
    );
    const bullionPurchasesCashback = bullionPurchasesAgg.reduce(
      (acc, r) => acc + r.totalCashbackPaid,
      0,
    );

    const formattedBullion = {
      sales: {
        totalCashIn: bullionSalesCashIn,
        totalMakingChargesProfit: bullionSalesMakingProfit,
        karat24_Gram:
          bullionSalesAgg.find((r) => r._id === 24)?.totalWeight || 0,
        karat21_Gram:
          bullionSalesAgg.find((r) => r._id === 21)?.totalWeight || 0,
      },
      purchases: {
        totalCashOut: bullionPurchasesCashOut,
        totalCashbackPaid: bullionPurchasesCashback,
        karat24_Gram:
          bullionPurchasesAgg.find((r) => r._id === 24)?.totalWeight || 0,
        karat21_Gram:
          bullionPurchasesAgg.find((r) => r._id === 21)?.totalWeight || 0,
      },
      netBullionCashflow: parseFloat(
        (bullionSalesCashIn - bullionPurchasesCashOut).toFixed(2),
      ),
    };

    // 4. الحركة النقدية المباشرة الخاصة بعمليات الذهب والسبايك
    const totalCashIn = parseFloat(
      (formattedNewGold.totalCashIn + bullionSalesCashIn).toFixed(2),
    );

    const totalCashOut = parseFloat(
      (formattedScrapGold.totalCashOut + bullionPurchasesCashOut).toFixed(2),
    );

    const netDailyCashflow = parseFloat(
      (totalCashIn - totalCashOut).toFixed(2),
    );

    return {
      reportPeriod: { startDate: start, endDate: end },
      sections: {
        newGold: {
          title: 'مبيعات الذهب الجديد (المشغولات)',
          ...formattedNewGold,
        },
        scrapGold: {
          title: 'مشتريات الذهب الكسر من العملاء',
          ...formattedScrapGold,
        },
        bullion: {
          title: 'السبايك والجنيهات (مبيعات ومشتريات)',
          ...formattedBullion,
        },
      },
      cashflowSummary: {
        totalCashIn,
        totalCashOut,
        netDailyCashflow,
      },
      netGoldWeightMovement: {
        karat24: parseFloat(
          (
            formattedBullion.sales.karat24_Gram -
            formattedBullion.purchases.karat24_Gram
          ).toFixed(3),
        ),
        karat21: parseFloat(
          (
            formattedNewGold.karat21_Gram +
            formattedBullion.sales.karat21_Gram -
            (formattedScrapGold.karat21_Gram +
              formattedBullion.purchases.karat21_Gram)
          ).toFixed(3),
        ),
        karat18: parseFloat(
          (
            formattedNewGold.karat18_Gram - formattedScrapGold.karat18_Gram
          ).toFixed(3),
        ),
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
