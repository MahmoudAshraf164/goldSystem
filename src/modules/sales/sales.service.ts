import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Invoice } from './schemas/invoice.schema';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { Inventory } from '../inventory/schemas/inventory.schema';
import { Customer } from '../customers/schemas/customer.schema';
import { StockMovementsService } from '../stock-movements/stock-movements.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

interface IProcessedItem {
  inventoryItem: Types.ObjectId;
  soldGrossWeight: number;
  soldNetWeight: number;
  hasTag: boolean;
  goldPriceToday: number;
  makingChargesPerGram: number;
  itemTotalPrice: number;
}

@Injectable()
export class SalesService {
  constructor(
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<Invoice>,
    @InjectModel(Inventory.name)
    private readonly inventoryModel: Model<Inventory>,
    @InjectModel(Customer.name) private readonly customerModel: Model<Customer>,
    private readonly movementsService: StockMovementsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─── 1. إصدار فاتورة بيع جديدة بدعم استقبال الـ tagWeight الديناميكي من الفرونت إند ───
  async createSale(
    createInvoiceDto: CreateInvoiceDto,
    userId: string,
  ): Promise<Invoice> {
    const { customer, items } = createInvoiceDto;

    const existingCustomer = await this.customerModel
      .findOne({ _id: customer, status: 'ACTIVE' })
      .exec();
    if (!existingCustomer)
      throw new NotFoundException('العميل المحدد غير موجود أو غير نشط');
    if (!items || items.length === 0)
      throw new BadRequestException('لا يمكن إصدار فاتورة فارغة بدون قطع');

    const processedItems: IProcessedItem[] = [];
    let totalInvoiceGrossWeight = 0;
    let totalInvoiceNetWeight = 0;
    let totalInvoicePrice = 0;

    const timestamp = Date.now().toString().slice(-6);
    const invoiceNumber = `GMS-${new Date().getFullYear()}-${timestamp}`;

    for (const itemDto of items) {
      const dbItem: any = await this.inventoryModel
        .findOne({ _id: itemDto.inventoryItem, isArchived: false })
        .exec();

      if (!dbItem)
        throw new NotFoundException(
          `البضاعة بالـ ID: ${itemDto.inventoryItem} غير موجودة`,
        );

      if (dbItem.currentCount < 1)
        throw new BadRequestException(
          `عذراً، نفدت الكمية من البضاعة: ${dbItem.title}`,
        );

      // 🛠️ الخطوة السحرية: اعتماد الوزن المبعوث من الواجهة، ولو مبعوتش ياخد أول وزن متاح بالمخزن
      let currentTagWeight = 0.06;
      if (itemDto.tagWeight !== undefined) {
        currentTagWeight = itemDto.tagWeight;
      } else if (dbItem.tagDetails && dbItem.tagDetails.length > 0) {
        currentTagWeight = dbItem.tagDetails[0].weight;
      }

      // حسبة الصافي الدقيقة بناءً على الـ tagWeight الفعلي المستلم
      const soldNetWeight = itemDto.hasTag
        ? parseFloat((itemDto.soldGrossWeight - currentTagWeight).toFixed(3))
        : itemDto.soldGrossWeight;

      if (
        dbItem.totalGrossWeight < itemDto.soldGrossWeight ||
        dbItem.totalNetWeight < soldNetWeight
      ) {
        throw new BadRequestException(
          `الوزن المحدد لـ ${dbItem.title} أكبر من المتاح بالمخزن`,
        );
      }

      const itemTotalPrice = parseFloat(
        (
          soldNetWeight *
          (itemDto.goldPriceToday + itemDto.makingChargesPerGram)
        ).toFixed(2),
      );

      const newCurrentCount = dbItem.currentCount - 1;
      const newTotalGrossWeight = parseFloat(
        (dbItem.totalGrossWeight - itemDto.soldGrossWeight).toFixed(3),
      );

      // 🛠️ تحديث مصفوفة التيكت: البحث عن الـ weight المطابق للوزن المبعوث وخصم قطعة منه
      const updatedTagDetails = [...(dbItem.tagDetails || [])];
      if (itemDto.hasTag && updatedTagDetails.length > 0) {
        const matchedTagIndex = updatedTagDetails.findIndex(
          (tag) => tag.weight === currentTagWeight,
        );

        if (matchedTagIndex > -1) {
          updatedTagDetails[matchedTagIndex].count -= 1;
          // لو تعداد الوزن المختار ده خلص، بنشيله من قائمة أوزان المستودع
          if (updatedTagDetails[matchedTagIndex].count <= 0) {
            updatedTagDetails.splice(matchedTagIndex, 1);
          }
        } else {
          // حالة احتياطية لو الفرونت إند بعت وزن مش متسجل في شحنة المخزن
          updatedTagDetails[0].count -= 1;
          if (updatedTagDetails[0].count <= 0) updatedTagDetails.shift();
        }
      }

      // إعادة حساب صافي وزن المستودع الكلي بناءً على ما تبقى في المصفوفة
      let remainingTagsWeight = 0;
      for (const tag of updatedTagDetails) {
        remainingTagsWeight += tag.count * tag.weight;
      }
      const newTotalNetWeight = parseFloat(
        (newTotalGrossWeight - remainingTagsWeight).toFixed(3),
      );

      await this.inventoryModel.updateOne(
        { _id: itemDto.inventoryItem },
        {
          $set: {
            currentCount: newCurrentCount,
            totalGrossWeight: newTotalGrossWeight,
            totalNetWeight: newTotalNetWeight,
            tagDetails: updatedTagDetails,
          },
        },
      );

      await this.movementsService.logMovement({
        inventoryItem: itemDto.inventoryItem,
        type: 'SALE_OUT',
        countChange: -1,
        grossWeightChange: -itemDto.soldGrossWeight,
        netWeightChange: -soldNetWeight,
        actionBy: userId,
        reason: `بيع قطعة بتيكت وزن (${currentTagWeight}ج) - شركة (${dbItem.companyName || '-'}) - فاتورة رقم: ${invoiceNumber}`,
      });

      processedItems.push({
        inventoryItem: new Types.ObjectId(itemDto.inventoryItem),
        soldGrossWeight: itemDto.soldGrossWeight,
        soldNetWeight,
        hasTag: itemDto.hasTag,
        goldPriceToday: itemDto.goldPriceToday,
        makingChargesPerGram: itemDto.makingChargesPerGram,
        itemTotalPrice,
      });

      totalInvoiceGrossWeight += itemDto.soldGrossWeight;
      totalInvoiceNetWeight += soldNetWeight;
      totalInvoicePrice += itemTotalPrice;
    }

    const newInvoice = new this.invoiceModel({
      invoiceNumber,
      customer: new Types.ObjectId(customer),
      items: processedItems,
      soldBy: new Types.ObjectId(userId),
      totalInvoiceGrossWeight: parseFloat(totalInvoiceGrossWeight.toFixed(3)),
      totalInvoiceNetWeight: parseFloat(totalInvoiceNetWeight.toFixed(3)),
      totalPrice: parseFloat(totalInvoicePrice.toFixed(2)),
    });

    const savedInvoice = await newInvoice.save();
    return savedInvoice.populate([
      { path: 'customer', select: 'fullName phoneNumber' },
      { path: 'items.inventoryItem', select: 'title karat companyName' },
      { path: 'soldBy', select: 'fullName role' },
    ]);
  }

  // ─── 2. تعديل الفاتورة الذكي ودعم ميزة الاسترجاع الجزئي والأوزان المصفوفية ───
  async updateInvoice(
    id: string,
    updateInvoiceDto: UpdateInvoiceDto,
    userId: string,
    userRole: string,
  ): Promise<Invoice> {
    const oldInvoice = await this.invoiceModel.findById(id).exec();
    if (!oldInvoice || oldInvoice.status === 'CANCELLED') {
      throw new NotFoundException('الفاتورة غير موجودة أو ملغية بالفعل');
    }

    const normalizedRole = userRole ? userRole.toUpperCase() : '';
    const isInvoiceOwner = oldInvoice.soldBy.equals(new Types.ObjectId(userId));

    if (normalizedRole !== 'OWNER' && !isInvoiceOwner) {
      throw new ForbiddenException(
        'عذراً، لا تملك الصلاحية لتعديل فاتورة أصدرها موظف آخر',
      );
    }

    if (updateInvoiceDto.customer) {
      const cust = await this.customerModel
        .findOne({ _id: updateInvoiceDto.customer, status: 'ACTIVE' })
        .exec();
      if (!cust) throw new NotFoundException('العميل الجديد غير موجود');
      oldInvoice.customer = new Types.ObjectId(updateInvoiceDto.customer);
    }

    if (updateInvoiceDto.items) {
      // أ- مرحلة إعادة الأرصدة القديمة للجرد بشكل موازن ومصفوقي
      for (const oldItem of oldInvoice.items) {
        const dbItem: any = await this.inventoryModel
          .findById(oldItem.inventoryItem)
          .exec();
        if (dbItem) {
          let currentTagWeight = 0.06;
          if (dbItem.tagDetails && dbItem.tagDetails.length > 0) {
            currentTagWeight = dbItem.tagDetails[0].weight;
          }

          const restoredCount = dbItem.currentCount + 1;
          const restoredGrossWeight = parseFloat(
            (dbItem.totalGrossWeight + oldItem.soldGrossWeight).toFixed(3),
          );

          const updatedTagDetails = [...(dbItem.tagDetails || [])];
          if (oldItem.hasTag) {
            const matchedIndex = updatedTagDetails.findIndex(
              (tag) => tag.weight === currentTagWeight,
            );
            if (matchedIndex > -1) {
              updatedTagDetails[matchedIndex].count += 1;
            } else {
              updatedTagDetails.unshift({ count: 1, weight: currentTagWeight });
            }
          }

          let remainingTagsWeight = 0;
          for (const tag of updatedTagDetails) {
            remainingTagsWeight += tag.count * tag.weight;
          }
          const restoredNetWeight = parseFloat(
            (restoredGrossWeight - remainingTagsWeight).toFixed(3),
          );

          await this.inventoryModel.updateOne(
            { _id: oldItem.inventoryItem },
            {
              $set: {
                currentCount: restoredCount,
                totalGrossWeight: restoredGrossWeight,
                totalNetWeight: restoredNetWeight,
                tagDetails: updatedTagDetails,
              },
            },
          );

          const isTotallyReturned = !updateInvoiceDto.items.some(
            (newItem) =>
              newItem.inventoryItem === oldItem.inventoryItem.toString(),
          );

          await this.movementsService.logMovement({
            inventoryItem: oldItem.inventoryItem.toString(),
            type: 'INVOICE_UPDATE_RETURN',
            countChange: 1,
            grossWeightChange: oldItem.soldGrossWeight,
            netWeightChange: oldItem.soldNetWeight,
            actionBy: userId,
            reason: isTotallyReturned
              ? `🔄 استرجاع كلي للقطعة وإرجاعها للمخزن - فاتورة رقم: ${oldInvoice.invoiceNumber}`
              : `إرجاع جرد مؤقت لإعادة احتساب الفاتورة رقم: ${oldInvoice.invoiceNumber}`,
          });
        }
      }

      // ب- إعادة الخصم بناءً على المصفوفة المحدثة والـ tagWeight المستلم
      const processedItems: any[] = [];
      let totalInvoiceGrossWeight = 0;
      let totalInvoiceNetWeight = 0;
      let totalInvoicePrice = 0;

      for (const newItemDto of updateInvoiceDto.items as any[]) {
        const dbItem: any = await this.inventoryModel
          .findOne({ _id: newItemDto.inventoryItem, isArchived: false })
          .exec();
        if (!dbItem)
          throw new NotFoundException('البضاعة المطلوبة غير موجودة في المخزن');

        let currentTagWeight = 0.06;
        if (newItemDto.tagWeight !== undefined) {
          currentTagWeight = newItemDto.tagWeight;
        } else if (dbItem.tagDetails && dbItem.tagDetails.length > 0) {
          currentTagWeight = dbItem.tagDetails[0].weight;
        }

        const soldNetWeight = newItemDto.hasTag
          ? parseFloat(
              (newItemDto.soldGrossWeight - currentTagWeight).toFixed(3),
            )
          : newItemDto.soldGrossWeight;

        if (
          dbItem.currentCount < 1 ||
          dbItem.totalGrossWeight < newItemDto.soldGrossWeight
        ) {
          throw new BadRequestException(
            `تحديث فشل: البضاعة المطلوبة غير متوفرة بالوزن الكافي`,
          );
        }

        const itemTotalPrice = parseFloat(
          (
            soldNetWeight *
            (newItemDto.goldPriceToday + newItemDto.makingChargesPerGram)
          ).toFixed(2),
        );

        const newCurrentCount = dbItem.currentCount - 1;
        const newTotalGrossWeight = parseFloat(
          (dbItem.totalGrossWeight - newItemDto.soldGrossWeight).toFixed(3),
        );

        const updatedTagDetails = [...(dbItem.tagDetails || [])];
        if (newItemDto.hasTag && updatedTagDetails.length > 0) {
          const matchedTagIndex = updatedTagDetails.findIndex(
            (tag) => tag.weight === currentTagWeight,
          );
          if (matchedTagIndex > -1) {
            updatedTagDetails[matchedTagIndex].count -= 1;
            if (updatedTagDetails[matchedTagIndex].count <= 0)
              updatedTagDetails.splice(matchedTagIndex, 1);
          } else {
            updatedTagDetails[0].count -= 1;
            if (updatedTagDetails[0].count <= 0) updatedTagDetails.shift();
          }
        }

        let remainingTagsWeight = 0;
        for (const tag of updatedTagDetails) {
          remainingTagsWeight += tag.count * tag.weight;
        }
        const newTotalNetWeight = parseFloat(
          (newTotalGrossWeight - remainingTagsWeight).toFixed(3),
        );

        await this.inventoryModel.updateOne(
          { _id: newItemDto.inventoryItem },
          {
            $set: {
              currentCount: newCurrentCount,
              totalGrossWeight: newTotalGrossWeight,
              totalNetWeight: newTotalNetWeight,
              tagDetails: updatedTagDetails,
            },
          },
        );

        processedItems.push({
          inventoryItem: new Types.ObjectId(newItemDto.inventoryItem),
          soldGrossWeight: newItemDto.soldGrossWeight,
          soldNetWeight,
          hasTag: newItemDto.hasTag,
          goldPriceToday: newItemDto.goldPriceToday,
          makingChargesPerGram: newItemDto.makingChargesPerGram,
          itemTotalPrice,
        });

        totalInvoiceGrossWeight += newItemDto.soldGrossWeight;
        totalInvoiceNetWeight += soldNetWeight;
        totalInvoicePrice += itemTotalPrice;
      }

      oldInvoice.items = processedItems as any;
      oldInvoice.totalInvoiceGrossWeight = parseFloat(
        totalInvoiceGrossWeight.toFixed(3),
      );
      oldInvoice.totalInvoiceNetWeight = parseFloat(
        totalInvoiceNetWeight.toFixed(3),
      );
      oldInvoice.totalPrice = parseFloat(totalInvoicePrice.toFixed(2));
    }

    return (await oldInvoice.save()).populate([
      { path: 'customer', select: 'fullName phoneNumber' },
      { path: 'items.inventoryItem', select: 'title karat companyName' },
      { path: 'soldBy', select: 'fullName role' },
    ]);
  }

  // ─── 3. إلغاء كلي للفاتورة بالكامل ───
  async cancelInvoice(id: string, userId: string): Promise<Invoice> {
    const invoice = await this.invoiceModel.findById(id).exec();
    if (!invoice) throw new NotFoundException('الفاتورة غير موجودة');
    if (invoice.status === 'CANCELLED')
      throw new BadRequestException('الملف ملغي سلفاً');

    for (const item of invoice.items) {
      const dbItem: any = await this.inventoryModel
        .findById(item.inventoryItem)
        .exec();
      if (dbItem) {
        let currentTagWeight = 0.06;
        if (dbItem.tagDetails && dbItem.tagDetails.length > 0) {
          currentTagWeight = dbItem.tagDetails[0].weight;
        }

        const restoredCount = dbItem.currentCount + 1;
        const restoredGrossWeight = parseFloat(
          (dbItem.totalGrossWeight + item.soldGrossWeight).toFixed(3),
        );

        const updatedTagDetails = [...(dbItem.tagDetails || [])];
        if (item.hasTag) {
          const matchedIndex = updatedTagDetails.findIndex(
            (tag) => tag.weight === currentTagWeight,
          );
          if (matchedIndex > -1) {
            updatedTagDetails[matchedIndex].count += 1;
          } else {
            updatedTagDetails.unshift({ count: 1, weight: currentTagWeight });
          }
        }

        let remainingTagsWeight = 0;
        for (const tag of updatedTagDetails) {
          remainingTagsWeight += tag.count * tag.weight;
        }
        const restoredNetWeight = parseFloat(
          (restoredGrossWeight - remainingTagsWeight).toFixed(3),
        );

        await this.inventoryModel.updateOne(
          { _id: item.inventoryItem },
          {
            $set: {
              currentCount: restoredCount,
              totalGrossWeight: restoredGrossWeight,
              totalNetWeight: restoredNetWeight,
              tagDetails: updatedTagDetails,
            },
          },
        );
      }
    }

    invoice.status = 'CANCELLED';
    invoice.totalPrice = 0;
    invoice.totalInvoiceGrossWeight = 0;
    invoice.totalInvoiceNetWeight = 0;

    return await invoice.save();
  }

  // ─── 4. جلب سجل الفواتير الشامل ───
  async findAllInvoices(
    query: { status?: string; invoiceNumber?: string },
    userId: string,
    userRole: string,
  ): Promise<Invoice[]> {
    const filter: any = {};
    if (query.status) filter.status = query.status.toUpperCase();
    if (query.invoiceNumber)
      filter.invoiceNumber = { $regex: query.invoiceNumber, $options: 'i' };

    if (userRole !== 'OWNER') {
      filter.soldBy = new Types.ObjectId(userId);
    }

    return this.invoiceModel
      .find(filter)
      .populate('customer', 'fullName phoneNumber')
      .populate('items.inventoryItem', 'title karat companyName')
      .populate('soldBy', 'fullName role')
      .sort({ createdAt: -1 })
      .exec();
  }
}
