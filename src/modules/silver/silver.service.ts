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
  SilverSafeConfig,
  SilverSafeConfigDocument,
} from './schemas/silver-safe-config.schema';
import {
  CreateSilverItemDto,
  QuickSilverSaleDto,
  BuySilverScrapDto,
  AdjustSilverSafeDto,
  UpdateSilverSafePasswordDto,
  SilverReportQueryDto,
  ReportRangeType,
} from './dto/silver.dto';
import { UpdateSilverItemDto } from './dto/UpdateSilverItem.dto';

@Injectable()
export class SilverService implements OnModuleInit {
  constructor(
    @InjectModel(SilverItem.name)
    private readonly silverItemModel: Model<SilverItemDocument>,
    @InjectModel(SilverSale.name)
    private readonly silverSaleModel: Model<SilverSaleDocument>,
    @InjectModel(SilverScrapPurchase.name)
    private readonly scrapModel: Model<SilverScrapPurchaseDocument>,
    @InjectModel(SilverSafeTransaction.name)
    private readonly safeModel: Model<SilverSafeTransactionDocument>,
    @InjectModel(SilverSafeConfig.name)
    private readonly safeConfigModel: Model<SilverSafeConfigDocument>,
  ) {}

  // 🔒 دالة خاصة للتحقق الداخلي من كلمة سر الخزنة
  private async verifySafePassword(providedPassword: string): Promise<boolean> {
    const config = await this.safeConfigModel.findOne().exec();
    if (!config) {
      throw new BadRequestException('لم يتم إنشاء كلمة سر للخزنة بعد. يرجى ضبط كلمة السر أولاً.');
    }
    return config.passwordHash === providedPassword;
  }

  async onModuleInit() {
    await this.silverItemModel.updateMany(
      { $or: [{ status: {$exists: false } }, { status: null }] },
      { $set: { status: 'AVAILABLE' } },
    );
  }

  // 🔑 إنشاء أو تحديث كلمة سر الخزنة
  async updateSafePassword(dto: UpdateSilverSafePasswordDto) {
    const config = await this.safeConfigModel.findOne().exec();

    if (config) {
      if (!dto.currentPassword) {
        throw new BadRequestException('كلمة السر الحالية مطلوبة لتعديل كلمة المرور');
      }
      if (config.passwordHash !== dto.currentPassword) {
        throw new UnauthorizedException('كلمة السر الحالية غير صحيحة');
      }
      config.passwordHash = dto.newPassword;
      await config.save();
    } else {
      await this.safeConfigModel.create({
        passwordHash: dto.newPassword,
      });
    }

    return { message: 'تم حفظ وتحديث كلمة سر الخزنة بنجاح' };
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

  // 2. إضافة وزن/كمية على صنف قائم
  async addStockToExistingItem(id: string, addedWeight: number, addedQuantity: number = 1) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('معرف القطعة غير صالح');
    }

    if (!addedWeight || Number(addedWeight) <= 0) {
      throw new BadRequestException('الوزن المضاف يجب أن يكون أكبر من الصفر');
    }

    const item = await this.silverItemModel.findById(id);
    if (!item) {
      throw new NotFoundException('قطعة الفضة غير موجودة');
    }

    item.weight += Number(addedWeight);
    item.quantity = ((item as any).quantity || 1) + Number(addedQuantity);
    item.status = 'AVAILABLE';

    return item.save();
  }

  // 3. عرض القطع المتاحة للبيع أو المخزون
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

  // 4. ملخص المخزون
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

  // 5. ملخص إجمالي أوزان الفضة مجتمعة لكل عيار
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
      isCancelled: false,
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

  // 10. إلغاء فاتورة بيع الفضة
  async cancelSaleInvoice(invoiceId: string, userId: string, reason?: string) {
    if (!Types.ObjectId.isValid(invoiceId)) {
      throw new BadRequestException('معرف الفاتورة غير صالح');
    }

    const sale = await this.silverSaleModel.findById(invoiceId);
    if (!sale) {
      throw new NotFoundException('فاتورة البيع غير موجودة');
    }

    if ((sale as any).isCancelled) {
      throw new BadRequestException('هذه الفاتورة ملغاة بالفعل مسبقاً');
    }

    const userObjectId = new Types.ObjectId(userId);

    if (sale.silverItem) {
      const item = await this.silverItemModel.findById(sale.silverItem);
      if (item) {
        item.weight += sale.weight;
        item.quantity = ((item as any).quantity || 0) + 1;
        item.status = 'AVAILABLE';
        await item.save();
      }
    }

    await this.safeModel.create({
      type: SilverTransactionType.ADJUSTMENT,
      amount: -sale.totalPrice,
      weightChange: sale.weight,
      karat: sale.karat,
      createdBy: userObjectId,
      notes: `إلغاء فاتورة بيع فضة رقم (${sale._id}) - السبب: ${reason || 'إرجاع للعميل'}`,
    });

    (sale as any).isCancelled = true;
    (sale as any).notes = `${sale.notes || ''} [ملغاة: ${reason || 'بدون سبب'}]`;
    await sale.save();

    return { message: 'تم إلغاء الفاتورة وإعادة الوزن للمخزون واسترداد المبلغ من الخزنة بنجاح', sale };
  }

  // 11. شراء كسر فضة
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

  // 12. دفتر فواتير شراء كسر الفضة
  async getScrapInvoices() {
    return this.scrapModel
      .find()
      .populate('purchasedBy', 'name username')
      .sort({ createdAt: -1 })
      .exec();
  }

  // 13. عرض مخزون كسر الفضة المتاح لكل عيار
  async getScrapInventorySummary() {
    return this.scrapModel.aggregate([
      {
        $group: {
          _id: '$karat',
          totalScrapWeight: { $sum: '$weight' },
          totalPaidAmount: { $sum: '$totalPaid' },
          totalTransactions: { $sum: 1 },         },       },       {$project: {
          _id: 0,
          karat: '$_id',
          totalScrapWeight: 1,
          totalPaidAmount: 1,
          totalTransactions: 1,
        },
      },
      { $sort: { karat: -1 } },
    ]);
  }

  // 14. استعلام رصيد خزنة الفضة (يتطلب كلمة السر)
  async getSilverSafeBalance(securityPassword: string) {
    const isValid = await this.verifySafePassword(securityPassword);
    if (!isValid) {
      throw new UnauthorizedException('كلمة سر الخزنة غير صحيحة');
    }

    const balanceResult = await this.safeModel.aggregate([
      { $group: { _id: null, totalCash: { $sum: '$amount' } } },
    ]);

    return {
      currentCashBalance: balanceResult[0]?.totalCash || 0,
    };
  }

  // 15. تصفير الخزنة (محمي بكلمة السر)
  async resetSafe(dto: AdjustSilverSafeDto, userId: string) {
    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new UnauthorizedException('معرف المستخدم غير صالح');
    }

    const isValid = await this.verifySafePassword(dto.securityPassword);
    if (!isValid) {
      throw new UnauthorizedException('كلمة سر الخزنة غير صحيحة، لا يمكن تصفير الخزنة');
    }

    const balanceResult = await this.safeModel.aggregate([
      { $group: { _id: null, totalCash: { $sum: '$amount' } } },
    ]);
    const currentCashBalance = balanceResult[0]?.totalCash || 0;

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

  // 16. تعديل رصيد الخزنة (محمي بكلمة السر)
  async adjustSafeBalance(dto: AdjustSilverSafeDto, userId: string) {
    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new UnauthorizedException('معرف المستخدم غير صالح');
    }

    const isValid = await this.verifySafePassword(dto.securityPassword);
    if (!isValid) {
      throw new UnauthorizedException('كلمة سر الخزنة غير صحيحة، لا يمكن تعديل رصيد الخزنة');
    }

    const balanceResult = await this.safeModel.aggregate([
      { $group: { _id: null, totalCash: { $sum: '$amount' } } },
    ]);
    const currentCashBalance = balanceResult[0]?.totalCash || 0;
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

  // 17. تقارير الفضة الشاملة
  async getSilverReport(query: SilverReportQueryDto) {
    let start: Date;
    let end: Date = new Date();

    const rangeType = query.rangeType || ReportRangeType.TODAY;

    switch (rangeType) {
      case ReportRangeType.TODAY: {
        start = new Date();
        start.setHours(0, 0, 0, 0);
        end = new Date();
        end.setHours(23, 59, 59, 999);
        break;
      }
      case ReportRangeType.YESTERDAY: {
        start = new Date();
        start.setDate(start.getDate() - 1);
        start.setHours(0, 0, 0, 0);

        end = new Date();
        end.setDate(end.getDate() - 1);
        end.setHours(23, 59, 59, 999);
        break;
      }
      case ReportRangeType.LAST_7_DAYS: {
        start = new Date();
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);

        end = new Date();
        end.setHours(23, 59, 59, 999);
        break;
      }
      case ReportRangeType.THIS_MONTH: {
        const now = new Date();
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      }
      case ReportRangeType.LAST_MONTH: {
        const now = new Date();
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        break;
      }
      case ReportRangeType.CUSTOM: {
        start = query.startDate ? new Date(query.startDate) : new Date();
        if (!query.startDate) start.setHours(0, 0, 0, 0);

        end = query.endDate ? new Date(query.endDate) : new Date();
        if (!query.endDate) end.setHours(23, 59, 59, 999);
        break;
      }
      default: {
        start = new Date();
        start.setHours(0, 0, 0, 0);
        end = new Date();
        end.setHours(23, 59, 59, 999);
      }
    }

    const filter = { createdAt: { $gte: start,$lte: end } };

    const sales = await this.silverSaleModel
      .find(filter)
      .populate('silverItem', 'title')
      .populate('soldBy', 'name username');

    const scrapPurchases = await this.scrapModel
      .find(filter)
      .populate('purchasedBy', 'name username');

    const safeTransactions = await this.safeModel
      .find(filter)
      .populate('createdBy', 'name username');

    const totalSalesIncome = sales.reduce(
      (acc, curr) => acc + ((curr as any).isCancelled ? 0 : curr.totalPrice),
      0,
    );

    const totalScrapExpenses = scrapPurchases.reduce(
      (acc, curr) => acc + curr.totalPaid,
      0,
    );

    const netCashFlow = totalSalesIncome - totalScrapExpenses;

    const totalSoldWeight = sales.reduce(
      (acc, curr) => acc + ((curr as any).isCancelled ? 0 : curr.weight),
      0,
    );

    const totalScrapBoughtWeight = scrapPurchases.reduce(
      (acc, curr) => acc + curr.weight,
      0,
    );

    return {
      rangeType,
      period: { startDate: start, endDate: end },
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
        salesCount: sales.filter((s) => !(s as any).isCancelled).length,
        cancelledSalesCount: sales.filter((s) => (s as any).isCancelled).length,
        scrapPurchasesCount: scrapPurchases.length,
        safeTransactionsCount: safeTransactions.length,
      },
      sales,
      scrapPurchases,
      safeTransactions,
    };
  }
}