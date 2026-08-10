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
import { StockMovementsService } from '../stock-movements/stock-movements.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SafeService } from '../safe/safe.service'; // 👈 استيراد خدمة الخزنة

@Injectable()
export class ScrapInvoicesService {
  constructor(
    @InjectModel(ScrapInvoice.name)
    private readonly scrapInvoiceModel: Model<ScrapInvoice>,
    @InjectModel(Customer.name) private readonly customerModel: Model<Customer>,
    @InjectModel(ScrapGold.name) private readonly scrapModel: Model<ScrapGold>,
    private readonly movementsService: StockMovementsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly safeService: SafeService, // 👈 حقن الخزنة
  ) {}

  // ─── 1. إصدار فاتورة بيع كسر جديدة وتوريد الكاش للخزنة ───
  async createInvoice(
    dto: CreateScrapInvoiceDto,
    userId: string,
  ): Promise<ScrapInvoice> {
    const { customer, karat, weight, goldPriceToday } = dto;

    const existingCustomer = await this.customerModel
      .findOne({ _id: customer, status: 'ACTIVE' })
      .exec();
    if (!existingCustomer)
      throw new NotFoundException(
        'عذراً، العميل المحدد غير موجود في النظام أو مؤرشف',
      );

    const scrapRecord = await this.scrapModel.findOne({ karat }).exec();
    if (!scrapRecord || scrapRecord.totalWeight < weight) {
      const available = scrapRecord ? scrapRecord.totalWeight : 0;
      throw new BadRequestException(
        `الرصيد غير كافٍ للبيع. المتاح من عيار ${karat} هو (${available} جرام) فقط`,
      );
    }

    let finalTotalPrice: number;
    let finalMakingChargesPerGram: number;

    if (dto.totalPrice !== undefined && dto.totalPrice !== null) {
      finalTotalPrice = Number(dto.totalPrice.toFixed(2));
      const calculatedMaking = finalTotalPrice / weight - goldPriceToday;

      if (calculatedMaking < 0) {
        throw new BadRequestException(
          'الإجمالي المدخل أقل من سعر الذهب خام بدون مصنعية!',
        );
      }
      finalMakingChargesPerGram = Number(calculatedMaking.toFixed(2));
    } else {
      finalMakingChargesPerGram = dto.makingChargesPerGram;
      finalTotalPrice = Number(
        (weight * (goldPriceToday + finalMakingChargesPerGram)).toFixed(2),
      );
    }

    scrapRecord.totalWeight = Number(
      (scrapRecord.totalWeight - weight).toFixed(3),
    );
    await scrapRecord.save();

    const timestamp = Date.now().toString().slice(-6);
    const invoiceNumber = `SCRAP-SALE-${new Date().getFullYear()}-${timestamp}`;

    const newInvoice = new this.scrapInvoiceModel({
      ...dto,
      invoiceNumber,
      makingChargesPerGram: finalMakingChargesPerGram,
      totalPrice: finalTotalPrice,
      status: 'COMPLETED',
      actionBy: new Types.ObjectId(userId),
    });

    const savedInvoice = await newInvoice.save();

    await this.movementsService.logMovement({
      inventoryItem: scrapRecord._id.toString(),
      type: 'SALE_OUT',
      countChange: 0,
      grossWeightChange: -weight,
      netWeightChange: -weight,
      actionBy: userId,
      reason: `بيع ذهب كسر عيار ${karat} بسعر جرام ${goldPriceToday} ومصنعية ${finalMakingChargesPerGram} بموجب فاتورة رقم: ${invoiceNumber}`,
    });

    // 💰 [الخزنة] توريد إجمالي الفاتورة للدرج
    await this.safeService.triggerTransaction(
      savedInvoice.totalPrice,
      'INFLOW',
      `بيع ذهب كسر - فاتورة رقم #${savedInvoice.invoiceNumber}`,
      userId,
    );

    const populatedInvoice = await savedInvoice.populate([
      { path: 'customer', select: 'fullName phoneNumber' },
      { path: 'actionBy', select: 'fullName role' },
    ]);

    this.eventEmitter.emit('scrap-invoice.created', populatedInvoice);
    return populatedInvoice;
  }

  // ─── 2. تحديث وتعديل الفاتورة وموازنة فروق الخزنة ───
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

    // 💰 حفظ السعر القديم للمقارنة
    const oldPrice = oldInvoice.totalPrice;

    const targetKarat = dto.karat !== undefined ? dto.karat : oldInvoice.karat;
    const targetWeight =
      dto.weight !== undefined ? dto.weight : oldInvoice.weight;
    const targetPriceToday =
      dto.goldPriceToday !== undefined
        ? dto.goldPriceToday
        : oldInvoice.goldPriceToday;

    if (dto.karat !== undefined || dto.weight !== undefined) {
      const oldScrapRecord = await this.scrapModel
        .findOne({ karat: oldInvoice.karat })
        .exec();
      if (oldScrapRecord) {
        oldScrapRecord.totalWeight = Number(
          (oldScrapRecord.totalWeight + oldInvoice.weight).toFixed(3),
        );
        await oldScrapRecord.save();
      }

      const newScrapRecord = await this.scrapModel
        .findOne({ karat: targetKarat })
        .exec();
      if (!newScrapRecord || newScrapRecord.totalWeight < targetWeight) {
        if (oldScrapRecord) {
          oldScrapRecord.totalWeight = Number(
            (oldScrapRecord.totalWeight - oldInvoice.weight).toFixed(3),
          );
          await oldScrapRecord.save();
        }
        const available = newScrapRecord ? newScrapRecord.totalWeight : 0;
        throw new BadRequestException(
          `رصيد عيار ${targetKarat} لا يكفي للتعديل. المتاح: (${available} جرام)`,
        );
      }

      newScrapRecord.totalWeight = Number(
        (newScrapRecord.totalWeight - targetWeight).toFixed(3),
      );
      await newScrapRecord.save();

      if (oldScrapRecord) {
        await this.movementsService.logMovement({
          inventoryItem: oldScrapRecord._id.toString(),
          type: 'INVOICE_UPDATE_RETURN',
          countChange: 0,
          grossWeightChange: oldInvoice.weight,
          netWeightChange: oldInvoice.weight,
          actionBy: userId,
          reason: `إرجاع وزن كسر قديم بسبب تعديل الفاتورة رقم: ${oldInvoice.invoiceNumber}`,
        });
      }

      await this.movementsService.logMovement({
        inventoryItem: newScrapRecord._id.toString(),
        type: 'INVOICE_UPDATE_OUT',
        countChange: 0,
        grossWeightChange: -targetWeight,
        netWeightChange: -targetWeight,
        actionBy: userId,
        reason: `خصم الوزن المعدل للفاتورة رقم: ${oldInvoice.invoiceNumber}`,
      });

      oldInvoice.karat = targetKarat;
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

    oldInvoice.goldPriceToday = targetPriceToday;

    if (dto.totalPrice !== undefined && dto.totalPrice !== null) {
      oldInvoice.totalPrice = Number(dto.totalPrice.toFixed(2));
      const calculatedMaking =
        oldInvoice.totalPrice / targetWeight - targetPriceToday;
      if (calculatedMaking < 0) {
        throw new BadRequestException(
          'الإجمالي المدخل أقل من سعر الذهب خام بدون مصنعية!',
        );
      }
      oldInvoice.makingChargesPerGram = Number(calculatedMaking.toFixed(2));
    } else {
      const targetMakingCharges =
        dto.makingChargesPerGram !== undefined
          ? dto.makingChargesPerGram
          : oldInvoice.makingChargesPerGram;
      oldInvoice.makingChargesPerGram = targetMakingCharges;
      oldInvoice.totalPrice = Number(
        (targetWeight * (targetPriceToday + targetMakingCharges)).toFixed(2),
      );
    }

    const updatedInvoice = await oldInvoice.save();

    // 💰 [الخزنة] حساب الفروقات وتعديل الكاش
    const newPrice = updatedInvoice.totalPrice;
    const diff = Number((newPrice - oldPrice).toFixed(2));

    if (diff > 0) {
      await this.safeService.triggerTransaction(
        diff,
        'INFLOW',
        `تعديل فاتورة بيع كسر رقم #${updatedInvoice.invoiceNumber} (زيادة قيمة الفاتورة)`,
        userId,
      );
    } else if (diff < 0) {
      await this.safeService.triggerTransaction(
        Math.abs(diff),
        'OUTFLOW',
        `تعديل فاتورة بيع كسر رقم #${updatedInvoice.invoiceNumber} (تخفيض قيمة الفاتورة)`,
        userId,
      );
    }

    return updatedInvoice.populate([
      { path: 'customer', select: 'fullName phoneNumber' },
      { path: 'actionBy', select: 'fullName role' },
    ]);
  }

  // ─── 3. إلغاء واسترجاع الفاتورة بالكامل وتصفير الكاش ───
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

    if (normalizedRole !== 'OWNER' && !isInvoiceCreator) {
      throw new ForbiddenException(
        'لا تملك صلاحية إلغاء فاتورة كسر لم تقم بإصدارها بنفسك',
      );
    }

    // 💰 حفظ القيمة المادية لسحبها من الخزينة
    const priceToRefund = invoice.totalPrice;

    const scrapRecord = await this.scrapModel
      .findOne({ karat: invoice.karat })
      .exec();
    if (scrapRecord) {
      scrapRecord.totalWeight = Number(
        (scrapRecord.totalWeight + invoice.weight).toFixed(3),
      );
      await scrapRecord.save();

      await this.movementsService.logMovement({
        inventoryItem: scrapRecord._id.toString(),
        type: 'INVENTORY_IN',
        countChange: 0,
        grossWeightChange: invoice.weight,
        netWeightChange: invoice.weight,
        actionBy: userId,
        reason: `❌ إلغاء كلي لفاتورة بيع الكسر رقم: ${invoice.invoiceNumber} وإعادة الوزن للخزنة`,
      });
    }

    invoice.status = 'CANCELLED';
    invoice.totalPrice = 0;
    const cancelledInvoice = await invoice.save();

    // 💰 [الخزنة] سحب كاش الفاتورة بالكامل من الدرج وارتجاعه للعميل
    if (priceToRefund > 0) {
      await this.safeService.triggerTransaction(
        priceToRefund,
        'OUTFLOW',
        `إلغاء فاتورة بيع الكسر رقم #${cancelledInvoice.invoiceNumber} وارتجاع النقدية للعميل`,
        userId,
      );
    }

    return cancelledInvoice.populate([
      { path: 'customer', select: 'fullName phoneNumber' },
      { path: 'actionBy', select: 'fullName role' },
    ]);
  }

  // ─── 4. جلب الفواتير (مع البحث المتقدم بالاسم والرقم) ───
  async findAll(
    query: {
      status?: string;
      invoiceNumber?: string;
      customerName?: string;
      customerPhone?: string;
    },
    userId: string,
    userRole: string,
  ): Promise<ScrapInvoice[]> {
    const filter: any = {};
    const normalizedRole = userRole ? userRole.toUpperCase() : '';

    if (query.status) filter.status = query.status.toUpperCase();
    if (query.invoiceNumber)
      filter.invoiceNumber = { $regex: query.invoiceNumber, $options: 'i' };

    // 🔍 البحث بالعميل
    if (query.customerName || query.customerPhone) {
      const customerFilter: any = {};
      if (query.customerName) {
        customerFilter.fullName = { $regex: query.customerName, $options: 'i' };
      }
      if (query.customerPhone) {
        customerFilter.phoneNumber = {
          $regex: query.customerPhone,
          $options: 'i',
        };
      }

      const matchedCustomers = await this.customerModel
        .find(customerFilter)
        .select('_id')
        .exec();
      const customerIds = matchedCustomers.map((c) => c._id);
      filter.customer = { $in: customerIds };
    }

    // ⛔ تم إيقاف شرط الفلترة أدناه لتظهر جميع فواتير الكسر لكافة الموظفين والمستخدمين
    // if (normalizedRole !== 'OWNER') {
    //   filter.actionBy = new Types.ObjectId(userId);
    // }

    return this.scrapInvoiceModel
      .find(filter)
      .populate('customer', 'fullName phoneNumber')
      .populate('actionBy', 'fullName role')
      .sort({ createdAt: -1 })
      .exec();
  }
}
