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
import {
  Inventory,
  InventoryDocument,
} from '../inventory/schemas/inventory.schema';
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
    @InjectModel(Inventory.name)
    private readonly inventoryModel: Model<InventoryDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly movementsService: StockMovementsService,
    private readonly safeService: SafeService,
    private readonly customersService: CustomersService,
  ) {}

  private async generateInvoiceNumber(): Promise<string> {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.invoiceModel.countDocuments().exec();
    return `POS-${dateStr}-${(count + 1).toString().padStart(4, '0')}`;
  }

  /**
   * دالة مساعدة لتحديث مصفوفة التيكيتات (tagDetails) والمقادير بالمخزون العام عند البيع أو الإرجاع
   */
  private async updateParentInventory(
    inventoryId: Types.ObjectId | string,
    grossWeight: number,
    netWeight: number,
    tagWeight: number,
    action: 'DEDUCT' | 'RESTORE',
    session: any,
  ) {
    const parentInventory = await this.inventoryModel
      .findById(inventoryId)
      .session(session);

    if (!parentInventory) return;

    const countFactor = action === 'DEDUCT' ? -1 : 1;

    // 1. تحديث الأعداد والأوزان الإجمالية
    parentInventory.currentCount = Math.max(
      0,
      parentInventory.currentCount + countFactor,
    );
    parentInventory.totalGrossWeight = parseFloat(
      (parentInventory.totalGrossWeight + grossWeight * countFactor).toFixed(3),
    );
    parentInventory.totalNetWeight = parseFloat(
      (parentInventory.totalNetWeight + netWeight * countFactor).toFixed(3),
    );

    // 2. تحديث مصفوفة التيكيتات (tagDetails) إن وجد وزن للتيكيت
    if (
      tagWeight &&
      tagWeight > 0 &&
      Array.isArray(parentInventory.tagDetails)
    ) {
      const tagIndex = parentInventory.tagDetails.findIndex(
        (t) => Math.abs(t.weight - tagWeight) < 0.001,
      );

      if (action === 'DEDUCT') {
        if (tagIndex !== -1) {
          parentInventory.tagDetails[tagIndex].count -= 1;
          if (parentInventory.tagDetails[tagIndex].count <= 0) {
            parentInventory.tagDetails.splice(tagIndex, 1);
          }
        }
      } else if (action === 'RESTORE') {
        if (tagIndex !== -1) {
          parentInventory.tagDetails[tagIndex].count += 1;
        } else {
          parentInventory.tagDetails.push({
            count: 1,
            weight: tagWeight,
          } as any);
        }
      }
    }

    await parentInventory.save({ session });
  }

  // 1. إتمام عملية البيع بالباركود وخصم البضاعة والتيكيت من المخزون العام
  // 1. إتمام عملية البيع بالباركود وخصم البضاعة والتيكيت من المخزون العام
  async createInvoice(
    dto: CreateBarcodeInvoiceDto,
    userId: string,
  ): Promise<BarcodeInvoice> {
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      let finalCustomerId: Types.ObjectId | undefined = undefined;

      // 🟢 أ) معالجة العميل: إما بـ ID موجود أو بإنشاء/ربط تلقائي بالاسم
      if (dto.customerId) {
        const customer = await this.customersService.findById(dto.customerId);
        finalCustomerId = customer._id as Types.ObjectId;
      } else if (dto.customerName && dto.customerName.trim() !== '') {
        const autoCustomer = await this.customersService.findOrCreateCustomer(
          dto.customerName,
          dto.phoneNumber,
          session,
        );
        finalCustomerId = autoCustomer._id as Types.ObjectId;
      }

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

        const goldPrice = saleItem.goldPricePerGram;
        const makingCharge =
          saleItem.makingChargePerGram ?? item.makingChargePerGram;

        const goldTotalPrice = parseFloat(
          (item.netWeight * goldPrice).toFixed(2),
        );
        const totalMakingCharge = parseFloat(
          (item.netWeight * makingCharge).toFixed(2),
        );
        const finalPrice = parseFloat(
          (goldTotalPrice + totalMakingCharge).toFixed(2),
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

        // تغيير حالة قطعة الباركود إلى مباعة SOLD
        item.status = 'SOLD';
        await item.save({ session });

        // الخصم الفوري للقطعة والتيكيت من المخزون العام الأصلي
        if (item.inventoryRef) {
          const tagWeight =
            (item as any).tagWeight ?? item.grossWeight - item.netWeight;
          await this.updateParentInventory(
            item.inventoryRef,
            item.grossWeight,
            item.netWeight,
            tagWeight,
            'DEDUCT',
            session,
          );
        }

        // تسجيل حركة الخروج
        await this.movementsService.logMovement({
          inventoryItem: (item.inventoryRef || item._id).toString(),
          type: 'SALE_OUT',
          countChange: -1,
          grossWeightChange: -item.grossWeight,
          netWeightChange: -item.netWeight,
          actionBy: userId,
          reason: `بيع قطعة بالباركود [${item.barcode}] - ${item.title} عبر فاتورة مبيعات`,
        });
      }

      const invoiceNumber = await this.generateInvoiceNumber();

      const newInvoice = new this.invoiceModel({
        invoiceNumber,
        items: processedItems,
        totalNetWeight: grandTotalNetWeight,
        finalPaidAmount: grandTotalAmount,
        customer: finalCustomerId, // 👈 تم ربط الـ ID النهائي سواء قديم أو تم إنشاؤه للتو
        createdBy: new Types.ObjectId(userId),
      });

      const savedInvoice = await newInvoice.save({ session });

      // تحصيل المبلغ للخزنة
      await this.safeService.triggerTransaction(
        savedInvoice.finalPaidAmount,
        'INFLOW',
        `تحصيل قيمة فاتورة بيع باركود رقم (${savedInvoice.invoiceNumber})`,
        userId,
      );

      await session.commitTransaction();
      session.endSession();

      return savedInvoice;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  // 2. جلب جميع الفواتير
  async findAllInvoices(): Promise<BarcodeInvoice[]> {
    return this.invoiceModel
      .find({ isCancelled: false })
      .populate('createdBy', 'name')
      .populate('customer', 'fullName phoneNumber')
      .sort({ createdAt: -1 })
      .exec();
  }

  // 3. جلب تفاصيل فاتورة بالـ ID
  async findInvoiceById(id: string): Promise<BarcodeInvoice> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('معرف الفاتورة غير صالح');
    }

    const invoice = await this.invoiceModel
      .findById(id)
      .populate('createdBy', 'name')
      .populate('customer', 'fullName phoneNumber')
      .exec();

    if (!invoice) {
      throw new NotFoundException('فاتورة المبيعات المطلوبة غير موجودة');
    }

    return invoice;
  }

  // 4. تعديل الفاتورة وتعديل التزامن والتيكيتات مع المخزون العام
  async updateInvoice(
    id: string,
    dto: CreateBarcodeInvoiceDto,
    userId: string,
  ): Promise<BarcodeInvoice> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('معرف الفاتورة غير صالح');
    }

    const existingInvoice = await this.invoiceModel.findById(id);
    if (!existingInvoice) {
      throw new NotFoundException('الفاتورة غير موجودة');
    }

    if (existingInvoice.isCancelled) {
      throw new BadRequestException('لا يمكن تعديل فاتورة ملغاة');
    }

    if (dto.customerId) {
      try {
        await this.customersService.findById(dto.customerId);
      } catch (error) {
        throw new NotFoundException('العميل المحدد غير موجود بالنظام');
      }
    }

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const oldItemsMap = new Map(
        existingInvoice.items.map((i) => [i.barcode, i]),
      );
      const newBarcodes = new Set(dto.items.map((i) => i.barcode.trim()));

      // 🟢 إعادة القطع والمأخوذات المحذوفة للتعديل للمخزون العام والتيكيتات
      for (const [barcode, oldItem] of oldItemsMap.entries()) {
        if (!newBarcodes.has(barcode)) {
          const barcodeItem = await this.barcodeInventoryModel
            .findById(oldItem.item)
            .session(session);

          if (barcodeItem) {
            barcodeItem.status = 'AVAILABLE';
            await barcodeItem.save({ session });

            if (barcodeItem.inventoryRef) {
              const tagWeight =
                (barcodeItem as any).tagWeight ??
                barcodeItem.grossWeight - barcodeItem.netWeight;
              await this.updateParentInventory(
                barcodeItem.inventoryRef,
                barcodeItem.grossWeight,
                barcodeItem.netWeight,
                tagWeight,
                'RESTORE',
                session,
              );
            }

            await this.movementsService.logMovement({
              inventoryItem: (
                barcodeItem.inventoryRef || barcodeItem._id
              ).toString(),
              type: 'INVOICE_UPDATE_RETURN',
              countChange: 1,
              grossWeightChange: barcodeItem.grossWeight,
              netWeightChange: barcodeItem.netWeight,
              actionBy: userId,
              reason: `إعادة القطعة [${barcode}] للمخزون العام والباركود نتيجة تعديل الفاتورة رقم (${existingInvoice.invoiceNumber})`,
            });
          }
        }
      }

      // 🟢 معالجة القطع المضافة حديثاً للتعديل
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
        const trimmedBarcode = saleItem.barcode.trim();
        const item = await this.barcodeInventoryModel
          .findOne({ barcode: trimmedBarcode, isArchived: false })
          .session(session)
          .exec();

        if (!item) {
          throw new NotFoundException(
            `القطعة ذات الباركود (${trimmedBarcode}) غير موجودة بالمخزن`,
          );
        }

        const wasInOldInvoice = oldItemsMap.has(trimmedBarcode);
        if (!wasInOldInvoice && item.status === 'SOLD') {
          throw new BadRequestException(
            `القطعة [${item.title}] ذات الباركود (${item.barcode}) مباعة بالفعل!`,
          );
        }

        if (!wasInOldInvoice) {
          item.status = 'SOLD';
          await item.save({ session });

          if (item.inventoryRef) {
            const tagWeight =
              (item as any).tagWeight ?? item.grossWeight - item.netWeight;
            await this.updateParentInventory(
              item.inventoryRef,
              item.grossWeight,
              item.netWeight,
              tagWeight,
              'DEDUCT',
              session,
            );
          }

          await this.movementsService.logMovement({
            inventoryItem: (item.inventoryRef || item._id).toString(),
            type: 'INVOICE_UPDATE_OUT',
            countChange: -1,
            grossWeightChange: -item.grossWeight,
            netWeightChange: -item.netWeight,
            actionBy: userId,
            reason: `خصم قطعة بالباركود [${item.barcode}] من المخزون العام للتعديل على الفاتورة (${existingInvoice.invoiceNumber})`,
          });
        }

        const goldPrice = saleItem.goldPricePerGram;
        const makingCharge =
          saleItem.makingChargePerGram ?? item.makingChargePerGram;

        const goldTotalPrice = parseFloat(
          (item.netWeight * goldPrice).toFixed(2),
        );
        const totalMakingCharge = parseFloat(
          (item.netWeight * makingCharge).toFixed(2),
        );
        const finalPrice = parseFloat(
          (goldTotalPrice + totalMakingCharge).toFixed(2),
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
      }

      // التسوية المالية للخزنة
      const oldAmount = existingInvoice.finalPaidAmount;
      const amountDifference = grandTotalAmount - oldAmount;

      if (amountDifference > 0) {
        await this.safeService.triggerTransaction(
          amountDifference,
          'INFLOW',
          `تحصيل فرق مال لتعديل فاتورة باركود رقم (${existingInvoice.invoiceNumber})`,
          userId,
        );
      } else if (amountDifference < 0) {
        await this.safeService.triggerTransaction(
          Math.abs(amountDifference),
          'OUTFLOW',
          `إرجاع فرق مال للعميل لتعديل فاتورة باركود رقم (${existingInvoice.invoiceNumber})`,
          userId,
        );
      }

      existingInvoice.items = processedItems;
      existingInvoice.totalNetWeight = grandTotalNetWeight;
      existingInvoice.finalPaidAmount = grandTotalAmount;
      existingInvoice.customer = dto.customerId
        ? new Types.ObjectId(dto.customerId)
        : undefined;

      const updatedInvoice = await existingInvoice.save({ session });

      await session.commitTransaction();
      session.endSession();

      return updatedInvoice;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  // 5. إلغاء فاتورة وإرجاع البضاعة والتيكيتات كاملة للمخزون العام
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
      for (const itemRef of invoice.items) {
        const barcodeItem = await this.barcodeInventoryModel
          .findById(itemRef.item)
          .session(session);

        if (barcodeItem) {
          barcodeItem.status = 'AVAILABLE';
          await barcodeItem.save({ session });

          // 🟢 إرجاع القطعة والتيكيت للمخزون العام
          if (barcodeItem.inventoryRef) {
            const tagWeight =
              (barcodeItem as any).tagWeight ??
              barcodeItem.grossWeight - barcodeItem.netWeight;
            await this.updateParentInventory(
              barcodeItem.inventoryRef,
              barcodeItem.grossWeight,
              barcodeItem.netWeight,
              tagWeight,
              'RESTORE',
              session,
            );
          }

          await this.movementsService.logMovement({
            inventoryItem: (
              barcodeItem.inventoryRef || barcodeItem._id
            ).toString(),
            type: 'INVOICE_CANCEL_RETURN',
            countChange: 1,
            grossWeightChange: barcodeItem.grossWeight,
            netWeightChange: barcodeItem.netWeight,
            actionBy: userId,
            reason: `إرجاع القطعة [${barcodeItem.barcode}] للمخزون العام نتيجة إلغاء الفاتورة رقم (${invoice.invoiceNumber})`,
          });
        }
      }

      // خصم المبلغ المرتجع من الخزنة
      await this.safeService.triggerTransaction(
        invoice.finalPaidAmount,
        'OUTFLOW',
        `إلغاء واسترداد فاتورة بيع باركود رقم (${invoice.invoiceNumber})`,
        userId,
      );

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
