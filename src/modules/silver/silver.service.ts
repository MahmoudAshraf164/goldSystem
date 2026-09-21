import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SilverItem, SilverItemDocument } from './schemas/silver-item.schema';
import { SilverSale, SilverSaleDocument } from './schemas/silver-sale.schema';
import {
  SilverScrapPurchase,
  SilverScrapPurchaseDocument,
} from './schemas/silver-scrap-purchase.schema';
import {
  SilverSafeTransaction,
  SilverSafeTransactionDocument,
  SilverTransactionType,
} from './schemas/silver-safe-transaction.schema';
import {
  CreateSilverItemDto,
  QuickSilverSaleDto,
  BuySilverScrapDto,
  AdjustSilverSafeDto,
} from './dto/silver.dto';

@Injectable()
export class SilverService {
  // يمكنك ضبط الباسورد من ملف .env أو استبداله بالرمز المعتمد لديك
  private readonly ADMIN_SAFE_PASSWORD = process.env.SILVER_SAFE_PASSWORD || 'AdminSafe#2026';

  constructor(
    @InjectModel(SilverItem.name)
    private readonly silverItemModel: Model<SilverItemDocument>,
    @InjectModel(SilverSale.name)
    private readonly silverSaleModel: Model<SilverSaleDocument>,
    @InjectModel(SilverScrapPurchase.name)
    private readonly scrapModel: Model<SilverScrapPurchaseDocument>,
    @InjectModel(SilverSafeTransaction.name)
    private readonly safeModel: Model<SilverSafeTransactionDocument>,
  ) {}

  // 1. إضافة قطعة للمخزون وتربيطها بالتصنيف الديناميكي
  async addSilverItem(dto: CreateSilverItemDto): Promise<SilverItem> {
    const newItem = new this.silverItemModel(dto);
    return newItem.save();
  }

  // 2. عرض المخزون المتاح مع عمل Populate للتصنيف الديناميكي
  async getAvailableItems(karat?: number, categoryId?: string) {
    const filter: any = { status: 'AVAILABLE' };
    if (karat) filter.karat = Number(karat);
    if (categoryId) filter.category = categoryId;

    return this.silverItemModel
      .find(filter)
      .populate('category', 'name code')
      .sort({ createdAt: -1 })
      .exec();
  }

  // 3. البيع السريع مع تسجيل اسم ورقم العميل
  async quickSale(dto: QuickSilverSaleDto, userId: string) {
    const item = await this.silverItemModel.findById(dto.itemId);
    if (!item || item.status !== 'AVAILABLE') {
      throw new NotFoundException('قطعة الفضة غير متاحة للبيع');
    }

    const totalPrice = item.weight * dto.pricePerGram;

    item.status = 'SOLD';
    await item.save();

    const sale = await this.silverSaleModel.create({
      silverItem: item._id,
      karat: item.karat,
      weight: item.weight,
      pricePerGram: dto.pricePerGram,
      totalPrice,
      customerName: dto.customerName,
      customerPhone: dto.customerPhone,
      soldBy: userId,
      notes: dto.notes,
    });

    await this.safeModel.create({
      type: SilverTransactionType.SALE_INCOME,
      amount: totalPrice,
      weightChange: -item.weight,
      karat: item.karat,
      createdBy: userId,
      notes: `بيع فضة - قطعة: ${item.title}${dto.customerName ? ` - العميل: ${dto.customerName}` : ''}`,
    });

    return sale;
  }

  // 4. شراء كسر فضة من زبون
  async buyScrap(dto: BuySilverScrapDto, userId: string) {
    const totalPaid = dto.weight * dto.pricePerGram;

    const scrap = await this.scrapModel.create({
      ...dto,
      totalPaid,
      purchasedBy: userId,
    });

    await this.safeModel.create({
      type: SilverTransactionType.SCRAP_PURCHASE_EXPENSE,
      amount: -totalPaid,
      weightChange: dto.weight,
      karat: dto.karat,
      createdBy: userId,
      notes: `شراء كسر فضة عيار ${dto.karat}${dto.customerName ? ` - العميل: ${dto.customerName}` : ''}`,
    });

    return scrap;
  }

  // 5. استعلام رصيد خزنة الفضة الحالي
  async getSilverSafeBalance() {
    const balanceResult = await this.safeModel.aggregate([
      { $group: { _id: null, totalCash: { $sum: '$amount' } } },
    ]);
    return {
      currentCashBalance: balanceResult[0]?.totalCash || 0,
    };
  }

  // 6. تصفير خزنة الفضة باستخدام باسوورد
  async resetSafe(dto: AdjustSilverSafeDto, userId: string) {
    if (dto.securityPassword !== this.ADMIN_SAFE_PASSWORD) {
      throw new UnauthorizedException('كلمة سر الحماية غير صحيحة، لا يمكن تصفير الخزنة');
    }

    const { currentCashBalance } = await this.getSilverSafeBalance();
    if (currentCashBalance === 0) {
      throw new BadRequestException('الخزنة صفراً بالفعل');
    }

    const adjustmentAmount = -currentCashBalance;

    return this.safeModel.create({
      type: SilverTransactionType.RESET,
      amount: adjustmentAmount,
      createdBy: userId,
      notes: dto.reason || 'تصفير خزنة الفضة بطلب الإدارة',
    });
  }

  // 7. تعديل رصيد الخزنة يدوياً باستعمال باسوورد الحماية
  async adjustSafeBalance(dto: AdjustSilverSafeDto, userId: string) {
    if (dto.securityPassword !== this.ADMIN_SAFE_PASSWORD) {
      throw new UnauthorizedException('كلمة سر الحماية غير صحيحة، لا يمكن تعديل رصيد الخزنة');
    }

    const { currentCashBalance } = await this.getSilverSafeBalance();
    const difference = dto.amount - currentCashBalance;

    return this.safeModel.create({
      type: SilverTransactionType.ADJUSTMENT,
      amount: difference,
      createdBy: userId,
      notes: dto.reason || `تعديل رصيد الخزنة من ${currentCashBalance} إلى ${dto.amount}`,
    });
  }

  // 8. تقرير مالي ووزني للفترة الزمانية
  async getSilverReport(startDate: Date, endDate: Date) {
    const filter = { createdAt: { $gte: startDate,$lte: endDate } };

    const sales = await this.silverSaleModel.find(filter).populate('silverItem', 'title');
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
}