import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ScrapInvoice } from './schemas/scrap-invoice.schema';
import { CreateScrapInvoiceDto } from './dto/create-scrap-invoice.dto';
import { UpdateScrapInvoiceDto } from './dto/update-scrap-invoice.dto';
import { ScrapGold } from '../scrap-gold/schemas/scrap-gold.schema';
import { Customer } from '../customers/schemas/customer.schema';
import { Category } from '../categories/schemas/category.schema';
import { StockMovementsService } from '../stock-movements/stock-movements.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class ScrapInvoicesService {
  constructor(
    @InjectModel(ScrapInvoice.name)
    private readonly scrapInvoiceModel: Model<ScrapInvoice>,
    @InjectModel(Customer.name) private readonly customerModel: Model<Customer>,
    @InjectModel(Category.name) private readonly categoryModel: Model<Category>,
    @InjectModel(ScrapGold.name) private readonly scrapModel: Model<ScrapGold>,
    private readonly movementsService: StockMovementsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─── 1. إصدار فاتورة بيع كسر جديدة ───
  async createInvoice(
    dto: CreateScrapInvoiceDto,
    userId: string,
  ): Promise<ScrapInvoice> {
    const {
      customer,
      karat,
      category,
      count,
      weight,
      goldPriceToday,
      makingChargesPerGram,
    } = dto;

    const existingCustomer = await this.customerModel
      .findOne({ _id: customer, status: 'ACTIVE' })
      .exec();
    if (!existingCustomer)
      throw new NotFoundException(
        'عذراً، العميل المحدد غير موجود في النظام أو مؤرشف',
      );

    const existingCategory = await this.categoryModel
      .findOne({ _id: category, isArchived: false })
      .exec();
    if (!existingCategory)
      throw new NotFoundException('عذراً، التصنيف المحدد غير موجود في النظام');

    const scrapRecord = await this.scrapModel.findOne({ karat }).exec();
    if (!scrapRecord)
      throw new BadRequestException(
        `لا يوجد أي رصيد ذهب كسر لعيار ${karat} في الخزنة`,
      );

    const itemIndex = scrapRecord.items.findIndex(
      (item) => item.category.toString() === category,
    );
    if (itemIndex === -1) {
      throw new NotFoundException(
        `عذراً، لا يوجد قطع كسر مسجلة من نوع (${existingCategory.name}) في الخزنة حالياً`,
      );
    }

    const targetItem = scrapRecord.items[itemIndex];
    if (targetItem.count < count || targetItem.weight < weight) {
      throw new BadRequestException(
        `الرصيد غير كافي للبيع. المتاح من ${existingCategory.name}: عدد (${targetItem.count}) وزن (${targetItem.weight} جرام)`,
      );
    }

    // خصم الكسر من الخزنة
    targetItem.count -= count;
    targetItem.weight = parseFloat((targetItem.weight - weight).toFixed(3));

    if (targetItem.count === 0 && targetItem.weight === 0) {
      scrapRecord.items.splice(itemIndex, 1);
    }
    await scrapRecord.save();

    const calculatedTotalPrice = parseFloat(
      (weight * (goldPriceToday + makingChargesPerGram)).toFixed(2),
    );
    const timestamp = Date.now().toString().slice(-6);
    const invoiceNumber = `SCRAP-SALE-${new Date().getFullYear()}-${timestamp}`;

    const newInvoice = new this.scrapInvoiceModel({
      ...dto,
      invoiceNumber,
      totalPrice: calculatedTotalPrice,
      status: 'COMPLETED',
      actionBy: new Types.ObjectId(userId),
    });

    const savedInvoice = await newInvoice.save();

    await this.movementsService.logMovement({
      inventoryItem: new Types.ObjectId(scrapRecord._id),
      type: 'SALE_OUT',
      countChange: -count,
      grossWeightChange: -weight,
      netWeightChange: -weight,
      actionBy: userId,
      reason: `بيع ذهب كسر بسعر جرام ${goldPriceToday} ومصنعية ${makingChargesPerGram} بموجب فاتورة رقم: ${invoiceNumber}`,
    });

    const populatedInvoice = await savedInvoice.populate([
      { path: 'customer', select: 'fullName phoneNumber' },
      { path: 'category', select: 'name' },
      { path: 'actionBy', select: 'fullName role' },
    ]);

    this.eventEmitter.emit('scrap-invoice.created', populatedInvoice);
    return populatedInvoice;
  }

  // ─── 2. تحديث وتعديل الفاتورة (الاسترجاع الجزئي مدمج) ───
  async updateInvoice(
    id: string,
    dto: UpdateScrapInvoiceDto,
    userId: string,
    userRole: string,
  ): Promise<ScrapInvoice> {
    const oldInvoice = await this.scrapInvoiceModel.findById(id).exec();
    if (!oldInvoice)
      throw new NotFoundException('فاتورة الكسر المطلوبة غير موجودة');
    if (oldInvoice.status === 'CANCELLED')
      throw new BadRequestException('لا يمكن تعديل فاتورة ملغاة بالفعل!');

    const normalizedRole = userRole ? userRole.toUpperCase() : '';
    const isInvoiceCreator = oldInvoice.actionBy.equals(
      new Types.ObjectId(userId),
    );

    if (normalizedRole !== 'OWNER' && !isInvoiceCreator) {
      throw new ForbiddenException(
        'عذراً، لا تملك الصلاحية لتعديل فاتورة كسر أصدرها مستخدم آخر',
      );
    }

    const targetKarat = dto.karat !== undefined ? dto.karat : oldInvoice.karat;
    const targetCategory =
      dto.category !== undefined
        ? dto.category
        : oldInvoice.category.toString();
    const targetCount = dto.count !== undefined ? dto.count : oldInvoice.count;
    const targetWeight =
      dto.weight !== undefined ? dto.weight : oldInvoice.weight;
    const targetPriceToday =
      dto.goldPriceToday !== undefined
        ? dto.goldPriceToday
        : oldInvoice.goldPriceToday;
    const targetMakingCharges =
      dto.makingChargesPerGram !== undefined
        ? dto.makingChargesPerGram
        : oldInvoice.makingChargesPerGram;

    if (dto.category) {
      const existsCat = await this.categoryModel
        .findOne({ _id: targetCategory, isArchived: false })
        .exec();
      if (!existsCat)
        throw new NotFoundException('التصنيف الجديد المحدد غير موجود أو مؤرشف');
    }

    // إدارة الجرد التراكمي وإعادة حساب الكتل المرتجعة/المخصومة في الخزنة
    if (
      dto.karat !== undefined ||
      dto.category !== undefined ||
      dto.count !== undefined ||
      dto.weight !== undefined
    ) {
      // 1. أولاً: نقوم بإرجاع الكميات القديمة بالكامل إلى مستودع الكسر لإعادة التوازن المالي
      const oldScrapRecord = await this.scrapModel
        .findOne({ karat: oldInvoice.karat })
        .exec();
      if (!oldScrapRecord)
        throw new BadRequestException(
          `لا يوجد رصيد كسر للعيار القديم ${oldInvoice.karat}`,
        );

      const oldItemIndex = oldScrapRecord.items.findIndex(
        (item) => item.category.toString() === oldInvoice.category.toString(),
      );
      if (oldItemIndex > -1) {
        oldScrapRecord.items[oldItemIndex].count += oldInvoice.count;
        oldScrapRecord.items[oldItemIndex].weight = parseFloat(
          (
            oldScrapRecord.items[oldItemIndex].weight + oldInvoice.weight
          ).toFixed(3),
        );
      } else {
        oldScrapRecord.items.push({
          category: oldInvoice.category,
          count: oldInvoice.count,
          weight: oldInvoice.weight,
        } as any);
      }
      await oldScrapRecord.save();

      // 2. ثانياً: نقوم بخصم المقادير الجديدة المحدثة من العيار المستهدف
      const newScrapRecord = await this.scrapModel
        .findOne({ karat: targetKarat })
        .exec();
      if (!newScrapRecord)
        throw new BadRequestException(
          `لا يوجد رصيد كسر متاح للعيار الجديد المستهدف ${targetKarat}`,
        );

      const newItemIndex = newScrapRecord.items.findIndex(
        (item) => item.category.toString() === targetCategory,
      );
      if (newItemIndex === -1)
        throw new NotFoundException(
          'الصنف المطلوب للتحديث غير متوفر رصيده في كسر الخزنة حالياً',
        );

      const targetItem = newScrapRecord.items[newItemIndex];
      if (targetItem.count < targetCount || targetItem.weight < targetWeight) {
        throw new BadRequestException(
          `الجرد بالخزنة لا يكفي للتعديل الحالي! المتاح: عدد (${targetItem.count}) وزن (${targetItem.weight} جرام)`,
        );
      }

      targetItem.count -= targetCount;
      targetItem.weight = parseFloat(
        (targetItem.weight - targetWeight).toFixed(3),
      );

      if (targetItem.count === 0 && targetItem.weight === 0) {
        newScrapRecord.items.splice(newItemIndex, 1);
      }
      await newScrapRecord.save();

      // تسجيل لوج الحركات المتبادلة
      await this.movementsService.logMovement({
        inventoryItem: oldScrapRecord._id.toString(),
        type: 'INVOICE_UPDATE_RETURN',
        countChange: oldInvoice.count,
        grossWeightChange: oldInvoice.weight,
        netWeightChange: oldInvoice.weight,
        actionBy: userId,
        reason: `إرجاع حسبة كسر قديمة بسبب تعديل الفاتورة رقم: ${oldInvoice.invoiceNumber}`,
      });

      await this.movementsService.logMovement({
        inventoryItem: newScrapRecord._id.toString(),
        type: 'INVOICE_UPDATE_OUT',
        countChange: -targetCount,
        grossWeightChange: -targetWeight,
        netWeightChange: -targetWeight,
        actionBy: userId,
        reason: `خصم حسبة الكسر المعدلة للفاتورة رقم: ${oldInvoice.invoiceNumber}`,
      });

      oldInvoice.karat = targetKarat;
      oldInvoice.category = new Types.ObjectId(targetCategory);
      oldInvoice.count = targetCount;
      oldInvoice.weight = targetWeight;
    }

    if (dto.customer) {
      const cust = await this.customerModel
        .findOne({ _id: dto.customer, status: 'ACTIVE' })
        .exec();
      if (!cust)
        throw new NotFoundException('العميل الجديد غير موجود أو غير نشط');
      oldInvoice.customer = new Types.ObjectId(dto.customer);
    }

    // الـ totalPrice يقل/يزيد تلقائياً بناءً على تقليل أو زيادة الأوزان الجديدة المدخلة
    oldInvoice.goldPriceToday = targetPriceToday;
    oldInvoice.makingChargesPerGram = targetMakingCharges;
    oldInvoice.totalPrice = parseFloat(
      (targetWeight * (targetPriceToday + targetMakingCharges)).toFixed(2),
    );

    return (await oldInvoice.save()).populate([
      { path: 'customer', select: 'fullName phoneNumber' },
      { path: 'category', select: 'name' },
      { path: 'actionBy', select: 'fullName role' },
    ]);
  }

  // ─── 3. إلغاء واسترجاع فاتورة الكسر بالكامل ───
  async cancelInvoice(
    id: string,
    userId: string,
    userRole: string,
  ): Promise<ScrapInvoice> {
    const invoice = await this.scrapInvoiceModel.findById(id).exec();
    if (!invoice)
      throw new NotFoundException('فاتورة الكسر المطلوبة غير موجودة');
    if (invoice.status === 'CANCELLED')
      throw new BadRequestException('هذه الفاتورة ملغاة بالفعل من قبل!');

    const normalizedRole = userRole ? userRole.toUpperCase() : '';
    const isInvoiceCreator = invoice.actionBy.equals(
      new Types.ObjectId(userId),
    );

    // أمان الصلاحيات: الموظف يكنسل فواتيره بس، الأونر يكنسل للكل
    if (normalizedRole !== 'OWNER' && !isInvoiceCreator) {
      throw new ForbiddenException(
        'لا تملك صلاحية إلغاء فاتورة كسر لم تقم بإصدارها بنفسك',
      );
    }

    // إرجاع البضاعة بالكامل لدفتر الكسر بالخزنة
    const scrapRecord = await this.scrapModel
      .findOne({ karat: invoice.karat })
      .exec();
    if (scrapRecord) {
      const itemIndex = scrapRecord.items.findIndex(
        (item) => item.category.toString() === invoice.category.toString(),
      );
      if (itemIndex > -1) {
        scrapRecord.items[itemIndex].count += invoice.count;
        scrapRecord.items[itemIndex].weight = parseFloat(
          (scrapRecord.items[itemIndex].weight + invoice.weight).toFixed(3),
        );
      } else {
        scrapRecord.items.push({
          category: invoice.category,
          count: invoice.count,
          weight: invoice.weight,
        } as any);
      }
      await scrapRecord.save();
    }

    // تسجيل الحركة العكسية في الـ Movements لإعادة الشحن
    await this.movementsService.logMovement({
      inventoryItem: new Types.ObjectId(scrapRecord?._id),
      type: 'INVENTORY_IN',
      countChange: invoice.count,
      grossWeightChange: invoice.weight,
      netWeightChange: invoice.weight,
      actionBy: userId,
      reason: `❌ إلغاء كلي لفاتورة بيع الكسر رقم: ${invoice.invoiceNumber} وإعادة السلع لجرد الخزنة`,
    });

    // تحويل حالة الفاتورة لملغاة وتصفير السعر محاسبياً لمسح أثرها المالي فوراً
    invoice.status = 'CANCELLED';
    invoice.totalPrice = 0; // تصفير القيمة داخل درج الخزنة اليومي

    return (await invoice.save()).populate([
      { path: 'customer', select: 'fullName phoneNumber' },
      { path: 'category', select: 'name' },
      { path: 'actionBy', select: 'fullName role' },
    ]);
  }

  // ─── 4. جلب الفواتير المسموحة ───
  async findAll(userId: string, userRole: string): Promise<ScrapInvoice[]> {
    const normalizedRole = userRole ? userRole.toUpperCase() : '';
    const filter: any = {};

    if (normalizedRole !== 'OWNER') {
      filter.actionBy = new Types.ObjectId(userId);
    }

    return this.scrapInvoiceModel
      .find(filter)
      .populate('customer', 'fullName phoneNumber')
      .populate('category', 'name')
      .populate('actionBy', 'fullName role')
      .sort({ createdAt: -1 })
      .exec();
  }
}
