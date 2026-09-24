import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
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
import { UpdateSilverItemDto } from './dto/UpdateSilverItem.dto';

@Injectable()
export class SilverService implements OnModuleInit {
  private readonly ADMIN_SAFE_PASSWORD =
    process.env.SILVER_SAFE_PASSWORD || '100100';

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

  async onModuleInit() {
    await this.silverItemModel.updateMany(
      { $or: [{ status: {$exists: false } }, { status: null }] },
      { $set: { status: 'AVAILABLE' } },
    );
  }

  // 1. إضافة قطعة جديدة لمخزون الفضة
  async addSilverItem(dto: CreateSilverItemDto): Promise<SilverItem> {
    const quantity = (dto as any).quantity ?? 1;
    const newItem = new this.silverItemModel({
      ...dto,
      category: new Types.ObjectId(dto.category),
      quantity,
      status: 'AVAILABLE',
    });
    return newItem.save();
  }

  // 2. إضافة وزن/كمية على صنف قائم (مثل دبلة موجودة مسبقاً)
  async addStockToExistingItem(id: string, addedWeight: number, addedQuantity: number = 1) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('معرف القطعة غير صالح');
    }

    if (addedWeight <= 0) {
      throw new BadRequestException('الوزن المضاف يجب أن يكون أكبر من الصفر');
    }

    const item = await this.silverItemModel.findById(id);
    if (!item) {
      throw new NotFoundException('قطعة الفضة غير موجودة');
    }

    item.weight += addedWeight;
    item.quantity = ((item as any).quantity || 1) + addedQuantity;
    item.status = 'AVAILABLE';

    return item.save();
  }

  // 3. عرض القطع المتاحة للبيع أو المخزون مع معالجة المرونة بالبحث
  async getAvailableItems(karat?: string | number, categoryId?: string, search?: string) {
    const filter: any = { status: 'AVAILABLE', weight: { $gt: 0 } };

    if (karat && karat !== 'all' && !isNaN(Number(karat))) {
      filter.karat = Number(karat);
    }

    if (
      categoryId &&
      typeof categoryId === 'string' &&
      categoryId.trim() !== '' &&
      categoryId !== 'undefined' &&
      categoryId !== 'null' &&
      categoryId.toLowerCase() !== 'all'
    ) {
      if (Types.ObjectId.isValid(categoryId)) {
        filter.category = new Types.ObjectId(categoryId);
      }
    }

    if (search && search.trim() !== '') {
      filter.title = { $regex: search.trim(),$options: 'i' };
    }

    return this.silverItemModel
      .find(filter)
      .populate('category', 'name code')
      .sort({ createdAt: -1 })
      .exec();
  }

  // 4. ملخص المخزون (تجميع بالعيار والتصنيف مع الأوزان والأعداد)
  async getInventorySummary() {
    return this.silverItemModel.aggregate([
      { $match: { status: 'AVAILABLE', weight: { $gt: 0 } } },       {$group: {
          _id: { category: '$category', karat: '$karat' },
          totalWeight: { $sum: '$weight' },
          totalCount: { $sum: {$ifNull: ['$quantity', 1] } },         },       },       {$lookup: {
          from: 'categories',
          localField: '_id.category',
          foreignField: '_id',
          as: 'categoryDetails',
        },
      },
      { $unwind: { path: '$categoryDetails', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          categoryId: '$_id.category',
          categoryName: { $ifNull: ['$categoryDetails.name', 'غير محدد'] },
          karat: '$_id.karat',
          totalWeight: 1,
          totalCount: 1,
        },
      },
      { $sort: { karat: -1, categoryName: 1 } },
    ]);
  }

  // 5. ملخص إجمالي أوزان الفضة مجتمعة لكل عيار بالكامل
  async getKaratSummary() {
    return this.silverItemModel.aggregate([
      { $match: { status: 'AVAILABLE', weight: { $gt: 0 } } },       {$group: {
          _id: '$karat',
          totalWeight: { $sum: '$weight' },
          totalItemsCount: { $sum: {$ifNull: ['$quantity', 1] } },         },       },       {$project: {
          _id: 0,
          karat: '$_id',
          totalWeight: 1,
          totalItemsCount: 1,
        },
      },
      { $sort: { karat: -1 } },
    ]);
  }

  // 6. تعديل قطعة في المخزون
  async updateSilverItem(id: string, dto: UpdateSilverItemDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('معرف القطعة غير صالح');
    }

    const updateData: any = { ...dto };
    if (dto.category) {
      if (!Types.ObjectId.isValid(dto.category)) {
        throw new BadRequestException('معرف التصنيف غير صالح');
      }
      updateData.category = new Types.ObjectId(dto.category);
    }

    const updatedItem = await this.silverItemModel
      .findByIdAndUpdate(id, { $set: updateData }, { new: true })
      .populate('category', 'name code');

    if (!updatedItem) {
      throw new NotFoundException('قطعة الفضة غير موجودة');
    }

    return updatedItem;
  }

  // 7. حذف قطعة من المخزون
  async deleteSilverItem(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('معرف القطعة غير صالح');
    }

    const deletedItem = await this.silverItemModel.findByIdAndDelete(id);
    if (!deletedItem) {
      throw new NotFoundException('قطعة الفضة غير موجودة أو تم حذفها سابقاً');
    }

    return { message: 'تم حذف قطعة الفضة من المخزون بنجاح', id };
  }

  // 8. بيع قطعة فضة سريع وتحديث الخزنة والمخزون
  async quickSale(dto: QuickSilverSaleDto, userId: string) {
    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new UnauthorizedException('معرف المستخدم غير صالح');
    }

    const item = await this.silverItemModel.findById(dto.itemId);
    if (!item || item.status !== 'AVAILABLE' || item.weight <= 0) {
      throw new NotFoundException('قطعة الفضة غير متاحة للبيع');
    }

    const inputWeight = (dto as any).weight;
    const soldWeight = inputWeight && Number(inputWeight) > 0 ? Number(inputWeight) : item.weight;

    if (soldWeight > item.weight) {
      throw new BadRequestException('الوزن المباع أكبر من الوزن المتاح في المخزن');
    }

    const totalPrice = soldWeight * dto.pricePerGram;
    const userObjectId = new Types.ObjectId(userId);

    item.weight -= soldWeight;
    if ((item as any).quantity && (item as any).quantity > 1) {
      (item as any).quantity -= 1;
    }

    if (item.weight <= 0) {
      item.weight = 0;
      item.status = 'SOLD';
    }
    await item.save();

    const sale = await this.silverSaleModel.create({
      silverItem: item._id,
      karat: item.karat,
      weight: soldWeight,
      pricePerGram: dto.pricePerGram,
      totalPrice,
      customerName: dto.customerName,
      customerPhone: dto.customerPhone,
      soldBy: userObjectId,
      notes: dto.notes,
    });

    await this.safeModel.create({
      type: SilverTransactionType.SALE_INCOME,
      amount: totalPrice,
      weightChange: -soldWeight,
      karat: item.karat,
      createdBy: userObjectId,
      notes: `بيع فضة - قطعة: ${item.title}${
        dto.customerName ? ` - العميل: ${dto.customerName}` : ''
      }`,
    });

    return sale;
  }

  // 9. دفتر فواتير بيع الفضة
  async getSalesInvoices() {
    return this.silverSaleModel
      .find()
      .populate('silverItem', 'title category')
      .populate('soldBy', 'name username')
      .sort({ createdAt: -1 })
      .exec();
  }

  // 10. شراء كسر فضة
  async buyScrap(dto: BuySilverScrapDto, userId: string) {
    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new UnauthorizedException('معرف المستخدم غير صالح');
    }

    const totalPaid = dto.weight * dto.pricePerGram;
    const userObjectId = new Types.ObjectId(userId);

    const scrap = await this.scrapModel.create({
      ...dto,
      totalPaid,
      purchasedBy: userObjectId,
    });

    await this.safeModel.create({
      type: SilverTransactionType.SCRAP_PURCHASE_EXPENSE,
      amount: -totalPaid,
      weightChange: dto.weight,
      karat: dto.karat,
      createdBy: userObjectId,
      notes: `شراء كسر فضة عيار ${dto.karat}${
        dto.customerName ? ` - العميل: ${dto.customerName}` : ''
      }`,
    });

    return scrap;
  }

  // 11. دفتر فواتير شراء كسر الفضة
  async getScrapInvoices() {
    return this.scrapModel
      .find()
      .populate('purchasedBy', 'name username')
      .sort({ createdAt: -1 })
      .exec();
  }

  // 12. استعلام رصيد خزنة الفضة
  async getSilverSafeBalance() {
    const balanceResult = await this.safeModel.aggregate([
      { $group: { _id: null, totalCash: { $sum: '$amount' } } },
    ]);
    return {
      currentCashBalance: balanceResult[0]?.totalCash || 0,
    };
  }

  // 13. تصفير الخزنة
  async resetSafe(dto: AdjustSilverSafeDto, userId: string) {
    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new UnauthorizedException('معرف المستخدم غير صالح');
    }

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
      createdBy: new Types.ObjectId(userId),
      notes: dto.reason || 'تصفير خزنة الفضة بطلب الإدارة',
    });
  }

  // 14. تعديل رصيد الخزنة
  async adjustSafeBalance(dto: AdjustSilverSafeDto, userId: string) {
    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new UnauthorizedException('معرف المستخدم غير صالح');
    }

    if (dto.securityPassword !== this.ADMIN_SAFE_PASSWORD) {
      throw new UnauthorizedException('كلمة سر الحماية غير صحيحة، لا يمكن تعديل رصيد الخزنة');
    }

    const { currentCashBalance } = await this.getSilverSafeBalance();
    const difference = dto.amount - currentCashBalance;

    return this.safeModel.create({
      type: SilverTransactionType.ADJUSTMENT,
      amount: difference,
      createdBy: new Types.ObjectId(userId),
      notes:
        dto.reason ||
        `تعديل رصيد الخزنة من ${currentCashBalance} إلى ${dto.amount}`,
    });
  }

  // 15. تقارير الفضة
  async getSilverReport(startDate: Date, endDate: Date) {
    const filter = { createdAt: { $gte: startDate,$lte: endDate } };

    const sales = await this.silverSaleModel
      .find(filter)
      .populate('silverItem', 'title');
    const scrapPurchases = await this.scrapModel.find(filter);
    const safeTransactions = await this.safeModel.find(filter);

    const totalSalesIncome = sales.reduce(
      (acc, curr) => acc + curr.totalPrice,
      0,
    );
    const totalScrapExpenses = scrapPurchases.reduce(
      (acc, curr) => acc + curr.totalPaid,
      0,
    );
    const netCashFlow = totalSalesIncome - totalScrapExpenses;

    const totalSoldWeight = sales.reduce((acc, curr) => acc + curr.weight, 0);
    const totalScrapBoughtWeight = scrapPurchases.reduce(
      (acc, curr) => acc + curr.weight,
      0,
    );

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