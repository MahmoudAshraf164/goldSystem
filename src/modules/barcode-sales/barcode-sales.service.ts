import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, Connection } from 'mongoose';
import {
  BarcodeInvoice,
  BarcodeInvoiceDocument,
} from './schemas/barcode-invoice.schema';
import {
  BarcodeInventory,
  BarcodeInventoryDocument,
} from '../barcode-inventory/schemas/barcode-inventory.schema';
import { CreateBarcodeInvoiceDto } from './dto/create-barcode-invoice.dto';
import { StockMovementsService } from '../stock-movements/stock-movements.service';
import { SafeService } from '../safe/safe.service';
import { CustomersService } from '../customers/customers.service';

@Injectable()
export class BarcodeSalesService {
  constructor(
    @InjectModel(BarcodeInvoice.name)
    private readonly invoiceModel: Model<BarcodeInvoiceDocument>,
    @InjectModel(BarcodeInventory.name)
    private readonly barcodeInventoryModel: Model<BarcodeInventoryDocument>,
    @InjectConnection() private readonly connection: Connection, // 👈 لدعم المجموعات والـ Transactions
    private readonly movementsService: StockMovementsService,
    private readonly safeService: SafeService,
    private readonly customersService: CustomersService,
  ) {}

  private async generateInvoiceNumber(): Promise<string> {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.invoiceModel.countDocuments().exec();
    return `POS-${dateStr}-${(count + 1).toString().padStart(4, '0')}`;
  }

  // 1. إتمام عملية البيع بالباركود مع Transaction وضمان عدم تضارب البيانات
  async createInvoice(
    dto: CreateBarcodeInvoiceDto,
    userId: string,
  ): Promise<BarcodeInvoice> {
    // التحقق من وجود العميل إذا تم إرساله
    if (dto.customerId) {
      const customerExists = await this.customersService.findOne(
        dto.customerId,
      );
      if (!customerExists) {
        throw new NotFoundException('العميل المحدد غير موجود بالنظام');
      }
    }

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const processedItems: Array<{
        item: Types.ObjectId;
        barcode: string;
        title: string;
        karat: number;
        netWeight: number;
        goldPricePerGram: number;
        goldTotalPrice: number;
        makingChargePerGram: number;
        totalMakingCharge: number;
        finalPrice: number;
      }> = [];

      let grandTotalNetWeight = 0;
      let grandTotalAmount = 0;

      for (const saleItem of dto.items) {
        // البحث عن القطعة وتأكيد وجودها وحالتها داخل الجلسة
        const item = await this.barcodeInventoryModel
          .findOne({ barcode: saleItem.barcode.trim(), isArchived: false })
          .session(session)
          .exec();

        if (!item) {
          throw new NotFoundException(
            `القطعة ذات الباركود (${saleItem.barcode}) غير موجودة بالمخزن`,
          );
        }

        if (item.status === 'SOLD') {
          throw new BadRequestException(
            `القطعة [${item.title}] ذات الباركود (${item.barcode}) مباعة بالفعل!`,
          );
        }

        // الحسابات المالية الدقيقة لكل قطعة
        const goldPrice = saleItem.goldPricePerGram;
        const makingCharge =
          saleItem.makingChargePerGram ?? item.makingChargePerGram;

        const goldTotalPrice = parseFloat(
          (item.netWeight * goldPrice).toFixed(2),
        );
        const totalMakingCharge = parseFloat(
          (item.netWeight * makingCharge).toFixed(2),
        );
        const itemDiscount = saleItem.customDiscount || 0;

        const finalPrice = parseFloat(
          (goldTotalPrice + totalMakingCharge - itemDiscount).toFixed(2),
        );

        processedItems.push({
          item: item._id as Types.ObjectId,
          barcode: item.barcode,
          title: item.title,
          karat: item.karat,
          netWeight: item.netWeight,
          goldPricePerGram: goldPrice,
          goldTotalPrice,
          makingChargePerGram: makingCharge,
          totalMakingCharge,
          finalPrice,
        });

        grandTotalNetWeight = parseFloat(
          (grandTotalNetWeight + item.netWeight).toFixed(3),
        );
        grandTotalAmount = parseFloat(
          (grandTotalAmount + finalPrice).toFixed(2),
        );

        // تحديث حالة القطعة إلى مباعة SOLD
        item.status = 'SOLD';
        await item.save({ session });

        // تسجيل حركة الخروج المالي والمخزني
        await this.movementsService.logMovement({
          inventoryItem: item._id.toString(),
          type: 'SALE_OUT',
          countChange: -1,
          grossWeightChange: -item.grossWeight,
          netWeightChange: -item.netWeight,
          actionBy: userId,
          reason: `بيع قطعة بالباركود [${item.barcode}] - ${item.title} عبر فاتورة مبيعات`,
        });
      }

      const discount = dto.discount || 0;
      const finalPaidAmount = parseFloat(
        (grandTotalAmount - discount).toFixed(2),
      );

      if (finalPaidAmount < 0) {
        throw new BadRequestException(
          'إجمالي المبلغ المدفوع لا يمكن أن يكون بالسالب',
        );
      }

      const invoiceNumber = await this.generateInvoiceNumber();

      // إنشاء وحفظ الفاتورة
      const newInvoice = new this.invoiceModel({
        invoiceNumber,
        items: processedItems,
        totalNetWeight: grandTotalNetWeight,
        totalAmount: grandTotalAmount,
        discount,
        finalPaidAmount,
        customer: dto.customerId
          ? new Types.ObjectId(dto.customerId)
          : undefined,
        paymentMethod: dto.paymentMethod || 'CASH',
        createdBy: new Types.ObjectId(userId),
      });

      const savedInvoice = await newInvoice.save({ session });

      // ربط وتسميع المبلغ في الخزنة كـ INFLOW أوتوماتيكياً
      await this.safeService.triggerTransaction(
        savedInvoice.finalPaidAmount,
        'INFLOW',
        `تحصيل قيمة فاتورة بيع باركود رقم (${savedInvoice.invoiceNumber})`,
        userId,
      );

      // تأكيد وإغلاق الجلسة بنجاح
      await session.commitTransaction();
      session.endSession();

      return savedInvoice;
    } catch (error) {
      // إرجاع القاعدة وتراجع البيانات في حال وجود أي مشكلة
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  // 2. جلب جميع فواتير مبيعات الباركود
  async findAllInvoices(): Promise<BarcodeInvoice[]> {
    return this.invoiceModel
      .find({ isCancelled: false })
      .populate('createdBy', 'name')
      .populate('customer', 'name phone')
      .sort({ createdAt: -1 })
      .exec();
  }

  // 3. جلب تفاصيل فاتورة باركود معينة بالـ ID
  async findInvoiceById(id: string): Promise<BarcodeInvoice> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('معرف الفاتورة غير صالح');
    }

    const invoice = await this.invoiceModel
      .findById(id)
      .populate('createdBy', 'name')
      .populate('customer', 'name phone')
      .exec();

    if (!invoice) {
      throw new NotFoundException('فاتورة المبيعات المطلوبة غير موجودة');
    }

    return invoice;
  }

  // 4. إلغاء فاتورة واسترجاع النقدية والمخزون
  async cancelInvoice(id: string, userId: string): Promise<BarcodeInvoice> {
    const invoice = await this.invoiceModel.findById(id);
    if (!invoice) {
      throw new NotFoundException('الفاتورة غير موجودة');
    }

    if (invoice.isCancelled) {
      throw new BadRequestException('الفاتورة ملغاة بالفعل');
    }

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      // 1. إعادة حالة القطع المباعة إلى المخزن IN_STOCK
      for (const itemRef of invoice.items) {
        const barcodeItem = await this.barcodeInventoryModel
          .findById(itemRef.item)
          .session(session);

        if (barcodeItem) {
          barcodeItem.status = 'IN_STOCK';
          await barcodeItem.save({ session });

          await this.movementsService.logMovement({
            inventoryItem: barcodeItem._id.toString(),
            type: 'INVENTORY_IN',
            countChange: 1,
            grossWeightChange: barcodeItem.grossWeight,
            netWeightChange: barcodeItem.netWeight,
            actionBy: userId,
            reason: `إلغاء فاتورة البيع رقم (${invoice.invoiceNumber}) واسترجاع القطعة للمخزن`,
          });
        }
      }

      // 2. خصم المبلغ المرتجع من الخزنة
      await this.safeService.triggerTransaction(
        invoice.finalPaidAmount,
        'OUTFLOW',
        `إلغاء واسترداد فاتورة بيع باركود رقم (${invoice.invoiceNumber})`,
        userId,
      );

      // 3. علام الفاتورة كـ ملغاة
      invoice.isCancelled = true;
      const updatedInvoice = await invoice.save({ session });

      await session.commitTransaction();
      session.endSession();

      return updatedInvoice;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw new InternalServerErrorException('حدث خطأ أثناء إلغاء الفاتورة');
    }
  }
}
