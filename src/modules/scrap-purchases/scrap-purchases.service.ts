import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ScrapPurchase } from './schemas/scrap-purchases.schema';
import { CreateScrapPurchaseDto } from './dto/create-scrap-purchases.dto';
import { UpdateScrapPurchaseDto } from './dto/update-scrap-purchases.dto';
import { ScrapGoldService } from '../scrap-gold/scrap-gold.service';
import { SafeService } from '../safe/safe.service';

@Injectable()
export class ScrapPurchasesService {
  constructor(
    @InjectModel(ScrapPurchase.name)
    private readonly scrapPurchaseModel: Model<ScrapPurchase>,
    private readonly scrapGoldService: ScrapGoldService,
    private readonly safeService: SafeService,
  ) {}

  // 1. تسجيل عملية شراء ذهب كسر جديدة
  async createPurchase(
    dto: CreateScrapPurchaseDto,
    userId: string,
  ): Promise<ScrapPurchase> {
    const count = await this.scrapPurchaseModel.countDocuments();
    const purchaseNumber = `SCRAP-${1001 + count}`;

    const newPurchase = new this.scrapPurchaseModel({
      ...dto,
      purchaseNumber,
      actionBy: new Types.ObjectId(userId),
    });

    const savedPurchase = await newPurchase.save();

    // أ) تحديث مخزون الذهب الكسر تلقائياً (زيادة الوزن بالعيار)
    await this.scrapGoldService.buyScrap(
      {
        karat: dto.karat,
        weight: dto.weight,
      },
      userId,
    );

    // ب) خصم المبلغ المالي فوراً من الخزنة (سيسمع تلقائياً في اليومية)
    await this.safeService.triggerTransaction(
      dto.totalPrice,
      'OUTFLOW',
      `شراء ذهب كسر رقم ${purchaseNumber} (وزن ${dto.weight}ج عيار ${dto.karat})`,
      userId,
    );

    return savedPurchase;
  }

  // 2. جلب جميع عمليات شراء الكسر
  async findAll(): Promise<ScrapPurchase[]> {
    return this.scrapPurchaseModel
      .find()
      .populate('actionBy', 'fullName role')
      .sort({ createdAt: -1 })
      .exec();
  }

  // 3. جلب عملية شراء محددة
  async findOne(id: string): Promise<ScrapPurchase> {
    const purchase = await this.scrapPurchaseModel
      .findById(id)
      .populate('actionBy', 'fullName role')
      .exec();

    if (!purchase) {
      throw new NotFoundException('عملية شراء الكسر غير موجودة');
    }

    return purchase;
  }

  // 4. تعديل عملية شراء كسر وتسوية الخزنة والمخزن أوتوماتيكياً
  async updatePurchase(
    id: string,
    dto: UpdateScrapPurchaseDto,
    userId: string,
  ): Promise<ScrapPurchase> {
    const existing = await this.scrapPurchaseModel.findById(id).exec();
    if (!existing) {
      throw new NotFoundException('عملية شراء الكسر المراد تعديلها غير موجودة');
    }

    const oldKarat = existing.karat;
    const oldWeight = existing.weight;
    const oldPrice = existing.totalPrice;

    const newKarat = dto.karat ?? oldKarat;
    const newWeight = dto.weight ?? oldWeight;
    const newPrice = dto.totalPrice ?? oldPrice;

    // أ) تعديل تسوية الخزنة بناءً على الفارق المالي
    const priceDiff = newPrice - oldPrice;
    if (priceDiff > 0) {
      // زيادة في المبلغ المدفوع -> خصم إضافي من الخزنة
      await this.safeService.triggerTransaction(
        priceDiff,
        'OUTFLOW',
        `تعديل فاتورة كسر ${existing.purchaseNumber} (زيادة السعر) - خصم ${priceDiff}ج.م`,
        userId,
      );
    } else if (priceDiff < 0) {
      // نقص في المبلغ المدفوع -> استرداد المتبقي للخزنة
      const refund = Math.abs(priceDiff);
      await this.safeService.triggerTransaction(
        refund,
        'INFLOW',
        `تعديل فاتورة كسر ${existing.purchaseNumber} (تخفيض السعر) - إرجاع ${refund}ج.م`,
        userId,
      );
    }

    // ب) تعديل تسوية المخزن (الوزن والعيار)
    if (oldKarat === newKarat) {
      const weightDiff = newWeight - oldWeight;
      if (weightDiff !== 0) {
        await this.scrapGoldService.buyScrap(
          { karat: newKarat, weight: weightDiff },
          userId,
        );
      }
    } else {
      // خصم الوزن القديم من العيار القديم
      await this.scrapGoldService.buyScrap(
        { karat: oldKarat, weight: -oldWeight },
        userId,
      );
      // إضافة الوزن الجديد للعيار الجديد
      await this.scrapGoldService.buyScrap(
        { karat: newKarat, weight: newWeight },
        userId,
      );
    }

    // ج) حفظ التعديلات الجديدة
    Object.assign(existing, dto, { actionBy: new Types.ObjectId(userId) });
    return existing.save();
  }

  // 5. حذف عملية شراء كسر وإرجاع الكاش ورد الوزن من المخزن
  async deletePurchase(
    id: string,
    userId: string,
  ): Promise<{ message: string }> {
    const purchase = await this.scrapPurchaseModel.findById(id).exec();
    if (!purchase) {
      throw new NotFoundException('عملية شراء الكسر المراد حذفها غير موجودة');
    }

    // أ) إرجاع النقدية بالكامل للخزنة (INFLOW)
    await this.safeService.triggerTransaction(
      purchase.totalPrice,
      'INFLOW',
      `إلغاء فاتورة شراء كسر رقم ${purchase.purchaseNumber} - إرجاع مبلغ ${purchase.totalPrice} ج.م الخزنة`,
      userId,
    );

    // ب) خصم الجرامات المضافة سابقاً من مخزون الكسر
    await this.scrapGoldService.buyScrap(
      {
        karat: purchase.karat,
        weight: -purchase.weight,
      },
      userId,
    );

    // ج) مسح الفاتورة من القاعدة
    await this.scrapPurchaseModel.findByIdAndDelete(id).exec();

    return {
      message:
        'تم حذف فاتورة الشراء بنجاح، واسترداد المبلغ للخزنة، وخصم الوزن من المخزن',
    };
  }
}
