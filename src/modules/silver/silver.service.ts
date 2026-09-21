import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ClientSession } from 'mongoose';
import { SilverItem, SilverItemDocument } from './schemas/silver-item.schema';
import { SilverSale, SilverSaleDocument } from './schemas/silver-sale.schema';
import { SilverScrapPurchase, SilverScrapPurchaseDocument } from './schemas/silver-scrap-purchase.schema';
import { SilverSafeTransaction, SilverSafeTransactionDocument, SilverTransactionType } from './schemas/silver-safe-transaction.schema';

@Injectable()
export class SilverService {
  constructor(
    @InjectModel(SilverItem.name) private silverItemModel: Model<SilverItemDocument>,
    @InjectModel(SilverSale.name) private silverSaleModel: Model<SilverSaleDocument>,
    @InjectModel(SilverScrapPurchase.name) private scrapModel: Model<SilverScrapPurchaseDocument>,
    @InjectModel(SilverSafeTransaction.name) private safeModel: Model<SilverSafeTransactionDocument>,
  ) {}

  // 1. بيع سريع بدون فاتورة وخصم من المخزون وتغذية خزنة الفضة
  async quickSale(itemId: string, pricePerGram: number, userId: string) {
    const item = await this.silverItemModel.findById(itemId);
    if (!item || item.status !== 'AVAILABLE') {
      throw new NotFoundException('قطعة الفضة غير متاحة للبيع');
    }

    const totalPrice = item.weight * pricePerGram;

    // خصم القطعة من المخزون
    item.status = 'SOLD';
    await item.save();

    // تسجيل البيعة
    const sale = await this.silverSaleModel.create({
      silverItem: item._id,
      karat: item.karat,
      weight: item.weight,
      pricePerGram,
      totalPrice,
      soldBy: userId,
    });

    // إضافة النقدية إلى خزنة الفضة
    await this.safeModel.create({
      type: SilverTransactionType.SALE_INCOME,
      amount: totalPrice,
      weightChange: -item.weight,
      karat: item.karat,
      createdBy: userId,
      notes: `بيع فضة سريع - قطعة: ${item.title}`,
    });

    return sale;
  }

  // 2. شراء كسر فضة من زبون وتخصيم المبلغ من الخزنة
  async buyScrap(dto: { karat: number; weight: number; pricePerGram: number; customerName?: string; customerPhone?: string }, userId: string) {
    const totalPaid = dto.weight * dto.pricePerGram;

    const scrap = await this.scrapModel.create({
      ...dto,
      totalPaid,
      purchasedBy: userId,
    });

    // خصم النقدية من خزنة الفضة
    await this.safeModel.create({
      type: SilverTransactionType.SCRAP_PURCHASE_EXPENSE,
      amount: -totalPaid,
      weightChange: dto.weight,
      karat: dto.karat,
      createdBy: userId,
      notes: `شراء كسر فضة عيار ${dto.karat}`,
    });

    return scrap;
  }

  // 3. تقارير الدخل والخزنة (يومي / أسبوعي / شهري)
  async getSilverReport(startDate: Date, endDate: Date) {
    const filter = { createdAt: { $gte: startDate,$lte: endDate } };

    const sales = await this.silverSaleModel.find(filter);
    const scrapPurchases = await this.scrapModel.find(filter);
    const safeTransactions = await this.safeModel.find(filter);

    const totalSalesIncome = sales.reduce((acc, curr) => acc + curr.totalPrice, 0);
    const totalScrapExpenses = scrapPurchases.reduce((acc, curr) => acc + curr.totalPaid, 0);
    const netCashFlow = totalSalesIncome - totalScrapExpenses;

    const totalSoldWeight = sales.reduce((acc, curr) => acc + curr.weight, 0);
    const totalScrapBoughtWeight = scrapPurchases.reduce((acc, curr) => acc + curr.weight, 0);

    return {
      period: { startDate, endDate },
      financialSummary: {
        totalSalesIncome,
        totalScrapExpenses,
        netCashFlow,
      },
      weightSummary: {
        totalSoldWeight,
        totalScrapBoughtWeight,
      },
      counts: {
        salesCount: sales.length,
        scrapPurchasesCount: scrapPurchases.length,
      },
      safeTransactions,
    };
  }

  // 4. رصيد خزنة الفضة الحالي
  async getSilverSafeBalance() {
    const balanceResult = await this.safeModel.aggregate([
      { $group: { _id: null, totalCash: { $sum: '$amount' } } },
    ]);
    return {
      currentCashBalance: balanceResult[0]?.totalCash || 0,
    };
  }

  // أضف هاتين الدالتين داخل كلاس SilverService في silver.service.ts:

// إضافة قطعة جديدة لمخزون الفضة
async addSilverItem(dto: any) {
  const newItem = new this.silverItemModel(dto);
  return newItem.save();
}

// عرض المخزون المتاح مع إمكانية الفلترة
async getAvailableItems(karat?: number, category?: string) {
  const filter: any = { status: 'AVAILABLE' };
  if (karat) filter.karat = Number(karat);
  if (category) filter.category = category;

  return this.silverItemModel.find(filter).sort({ createdAt: -1 }).exec();
}
}

