import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Invoice } from './schemas/invoice.schema';
import {
  CreateInvoiceDto,
  CreateInvoiceItemDto,
} from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { Inventory } from '../inventory/schemas/inventory.schema';
import { Customer } from '../customers/schemas/customer.schema';
import { StockMovementsService } from '../stock-movements/stock-movements.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SafeService } from '../safe/safe.service'; // 👈 استيراد خدمة الخزنة

interface IPreparedItem {
  itemDto: CreateInvoiceItemDto;
  dbItem: any;
  totalCalculatedTagWeight: number;
  soldNetWeight: number;
  makingChargesPerGram: number;
  itemTotalPrice: number;
}

interface IProcessedItem {
  inventoryItem: Types.ObjectId;
  soldCount: number;
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
    private readonly safeService: SafeService, // 👈 حقن خدمة الخزنة هنا
  ) {}

  // ─── 1. إصدار فاتورة بيع جديدة لدعم المجموعات والكميات وتحديث الخزنة ───
  async createSale(
    createInvoiceDto: CreateInvoiceDto,
    userId: string,
  ): Promise<Invoice> {
    const {
      customer,
      items,
      totalPrice: overrideTotalPrice,
    } = createInvoiceDto;

    const existingCustomer = await this.customerModel
      .findOne({ _id: customer, status: 'ACTIVE' })
      .exec();
    if (!existingCustomer)
      throw new NotFoundException('العميل المحدد غير موجود أو غير نشط');
    if (!items || items.length === 0)
      throw new BadRequestException('لا يمكن إصدار فاتورة فارغة بدون قطع');

    const timestamp = Date.now().toString().slice(-6);
    const invoiceNumber = `GMS-${new Date().getFullYear()}-${timestamp}`;

    const inventoryMap = new Map<string, any>();

    const getInventoryItem = async (inventoryId: string) => {
      if (!inventoryMap.has(inventoryId)) {
        const dbItem = await this.inventoryModel
          .findOne({ _id: inventoryId, isArchived: false })
          .exec();
        if (!dbItem) {
          throw new NotFoundException(
            `البضاعة بالـ ID: ${inventoryId} غير موجودة`,
          );
        }
        inventoryMap.set(inventoryId, dbItem.toObject());
      }
      return inventoryMap.get(inventoryId);
    };

    const preparedItems: IPreparedItem[] = [];
    let calculatedSumTotalPrice = 0;

    for (const itemDto of items) {
      const dbItem = await getInventoryItem(itemDto.inventoryItem);

      if (dbItem.currentCount < itemDto.soldCount)
        throw new BadRequestException(
          `عذراً، الكمية المتاحة في المخزن من (${dbItem.title}) هي ${dbItem.currentCount} قطع فقط، والمطلوب ${itemDto.soldCount}`,
        );

      let totalCalculatedTagWeight = 0;

      if (itemDto.hasTag) {
        if (dbItem.tagDetails && dbItem.tagDetails.length > 0) {
          let neededCount = itemDto.soldCount;
          const tempTagDetails = JSON.parse(JSON.stringify(dbItem.tagDetails));

          for (const tag of tempTagDetails) {
            if (neededCount <= 0) break;
            const take = Math.min(tag.count, neededCount);
            totalCalculatedTagWeight += take * tag.weight;
            neededCount -= take;
          }
          if (neededCount > 0) {
            totalCalculatedTagWeight += neededCount * 0.06;
          }
        } else {
          totalCalculatedTagWeight = itemDto.soldCount * 0.06;
        }
      }

      const soldNetWeight = parseFloat(
        (itemDto.soldGrossWeight - totalCalculatedTagWeight).toFixed(3),
      );

      if (
        dbItem.totalGrossWeight < itemDto.soldGrossWeight ||
        dbItem.totalNetWeight < soldNetWeight
      ) {
        throw new BadRequestException(
          `الوزن المحدد لـ ${dbItem.title} أكبر من إجمالي المتاح بالمخزن`,
        );
      }

      let itemTotalPrice = parseFloat(
        (
          soldNetWeight *
          (itemDto.goldPriceToday + itemDto.makingChargesPerGram)
        ).toFixed(2),
      );

      let finalMakingChargesPerGram = itemDto.makingChargesPerGram;

      if (
        itemDto.itemTotalPrice !== undefined &&
        itemDto.itemTotalPrice !== null
      ) {
        itemTotalPrice = parseFloat(itemDto.itemTotalPrice.toFixed(2));
        const calculatedMaking =
          itemTotalPrice / soldNetWeight - itemDto.goldPriceToday;
        if (calculatedMaking < 0) {
          throw new BadRequestException(
            `السعر المحدد للمجموعة ${dbItem.title} أقل من قيمة الذهب الخام الصافي!`,
          );
        }
        finalMakingChargesPerGram = parseFloat(calculatedMaking.toFixed(2));
      }

      calculatedSumTotalPrice += itemTotalPrice;

      dbItem.currentCount -= itemDto.soldCount;
      dbItem.totalGrossWeight = parseFloat(
        (dbItem.totalGrossWeight - itemDto.soldGrossWeight).toFixed(3),
      );
      dbItem.totalNetWeight = parseFloat(
        (dbItem.totalNetWeight - soldNetWeight).toFixed(3),
      );

      preparedItems.push({
        itemDto,
        dbItem,
        totalCalculatedTagWeight,
        soldNetWeight,
        makingChargesPerGram: finalMakingChargesPerGram,
        itemTotalPrice,
      });
    }

    inventoryMap.clear();

    const hasGlobalOverride =
      overrideTotalPrice !== undefined && overrideTotalPrice !== null;
    const finalInvoiceTotalPrice = hasGlobalOverride
      ? parseFloat((overrideTotalPrice as number).toFixed(2))
      : parseFloat(calculatedSumTotalPrice.toFixed(2));

    const processedItems: IProcessedItem[] = [];
    let totalInvoiceGrossWeight = 0;
    let totalInvoiceNetWeight = 0;

    for (const prep of preparedItems) {
      const { itemDto, totalCalculatedTagWeight, soldNetWeight } = prep;
      let { makingChargesPerGram, itemTotalPrice } = prep;

      const dbItem: any = await this.inventoryModel
        .findById(itemDto.inventoryItem)
        .exec();

      if (hasGlobalOverride && calculatedSumTotalPrice > 0) {
        const ratio = finalInvoiceTotalPrice / calculatedSumTotalPrice;
        itemTotalPrice = parseFloat((itemTotalPrice * ratio).toFixed(2));

        const calculatedMaking =
          itemTotalPrice / soldNetWeight - itemDto.goldPriceToday;
        if (calculatedMaking < 0) {
          throw new BadRequestException(
            `الإجمالي الكلي للفاتورة ينتج عنه مصنعية بالسالب للمجموعة: ${dbItem.title}`,
          );
        }
        makingChargesPerGram = parseFloat(calculatedMaking.toFixed(2));
      }

      const newCurrentCount = dbItem.currentCount - itemDto.soldCount;
      const newTotalGrossWeight = parseFloat(
        (dbItem.totalGrossWeight - itemDto.soldGrossWeight).toFixed(3),
      );

      const updatedTagDetails = [...(dbItem.tagDetails || [])];
      if (itemDto.hasTag && updatedTagDetails.length > 0) {
        let neededCount = itemDto.soldCount;

        for (let i = updatedTagDetails.length - 1; i >= 0; i--) {
          if (neededCount <= 0) break;
          if (updatedTagDetails[i].count <= neededCount) {
            neededCount -= updatedTagDetails[i].count;
            updatedTagDetails.splice(i, 1);
          } else {
            updatedTagDetails[i].count -= neededCount;
            neededCount = 0;
          }
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
        countChange: -itemDto.soldCount,
        grossWeightChange: -itemDto.soldGrossWeight,
        netWeightChange: -soldNetWeight,
        actionBy: userId,
        reason: `بيع عدد (${itemDto.soldCount}) قطع مجمعة بوزن إجمالي (${itemDto.soldGrossWeight}ج) - فاتورة رقم: ${invoiceNumber}`,
      });

      processedItems.push({
        inventoryItem: new Types.ObjectId(itemDto.inventoryItem),
        soldCount: itemDto.soldCount,
        soldGrossWeight: itemDto.soldGrossWeight,
        soldNetWeight,
        hasTag: itemDto.hasTag,
        goldPriceToday: itemDto.goldPriceToday,
        makingChargesPerGram,
        itemTotalPrice,
      });

      totalInvoiceGrossWeight += itemDto.soldGrossWeight;
      totalInvoiceNetWeight += soldNetWeight;
    }

    const newInvoice = new this.invoiceModel({
      invoiceNumber,
      customer: new Types.ObjectId(customer),
      items: processedItems,
      soldBy: new Types.ObjectId(userId),
      totalInvoiceGrossWeight: parseFloat(totalInvoiceGrossWeight.toFixed(3)),
      totalInvoiceNetWeight: parseFloat(totalInvoiceNetWeight.toFixed(3)),
      totalPrice: finalInvoiceTotalPrice,
    });

    const savedInvoice = await newInvoice.save();

    // 💰 [تحديث الخزنة تلقائياً] زيادة كاش الدرج بقيمة الفاتورة
    await this.safeService.triggerTransaction(
      savedInvoice.totalPrice,
      'INFLOW',
      `بيع ذهب جديد - فاتورة رقم #${savedInvoice.invoiceNumber}`,
      userId,
    );

    return savedInvoice.populate([
      { path: 'customer', select: 'fullName phoneNumber' },
      { path: 'items.inventoryItem', select: 'title karat companyName' },
      { path: 'soldBy', select: 'fullName role' },
    ]);
  }

  // ─── 2. تعديل الفاتورة بدعم الجرد الذكي وحساب فرق الكاش بالخزنة ───
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

    // 💰 حفظ القيمة النقدية القديمة قبل التعديل لحساب الفرق
    const oldPrice = oldInvoice.totalPrice;

    if (updateInvoiceDto.customer) {
      const cust = await this.customerModel
        .findOne({ _id: updateInvoiceDto.customer, status: 'ACTIVE' })
        .exec();
      if (!cust) throw new NotFoundException('العميل الجديد غير موجود');
      oldInvoice.customer = new Types.ObjectId(updateInvoiceDto.customer);
    }

    if (updateInvoiceDto.items && updateInvoiceDto.items.length > 0) {
      for (const oldItem of oldInvoice.items) {
        const dbItem: any = await this.inventoryModel
          .findById(oldItem.inventoryItem)
          .exec();
        if (dbItem) {
          const restoredCount = dbItem.currentCount + oldItem.soldCount;
          const restoredGrossWeight = parseFloat(
            (dbItem.totalGrossWeight + oldItem.soldGrossWeight).toFixed(3),
          );

          const updatedTagDetails = [...(dbItem.tagDetails || [])];
          if (oldItem.hasTag) {
            const estimatedTagWeight =
              oldItem.soldNetWeight > 0
                ? parseFloat(
                    (
                      (oldItem.soldGrossWeight - oldItem.soldNetWeight) /
                      oldItem.soldCount
                    ).toFixed(3),
                  )
                : 0.06;
            updatedTagDetails.unshift({
              count: oldItem.soldCount,
              weight: estimatedTagWeight,
            });
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
        }
      }

      const preparedItems: IPreparedItem[] = [];
      let calculatedSumTotalPrice = 0;

      for (const newItemDto of updateInvoiceDto.items as CreateInvoiceItemDto[]) {
        const dbItem: any = await this.inventoryModel
          .findOne({ _id: newItemDto.inventoryItem, isArchived: false })
          .exec();
        if (!dbItem)
          throw new NotFoundException('البضاعة المطلوبة غير موجودة في المخزن');

        let totalCalculatedTagWeight = 0;

        if (newItemDto.hasTag) {
          if (dbItem.tagDetails && dbItem.tagDetails.length > 0) {
            let neededCount = newItemDto.soldCount;
            const tempTagDetails = JSON.parse(
              JSON.stringify(dbItem.tagDetails),
            );

            for (const tag of tempTagDetails) {
              if (neededCount <= 0) break;
              const take = Math.min(tag.count, neededCount);
              totalCalculatedTagWeight += take * tag.weight;
              neededCount -= take;
            }
            if (neededCount > 0) {
              totalCalculatedTagWeight += neededCount * 0.06;
            }
          } else {
            totalCalculatedTagWeight = newItemDto.soldCount * 0.06;
          }
        }

        const soldNetWeight = parseFloat(
          (newItemDto.soldGrossWeight - totalCalculatedTagWeight).toFixed(3),
        );

        if (
          dbItem.currentCount < newItemDto.soldCount ||
          dbItem.totalGrossWeight < newItemDto.soldGrossWeight
        ) {
          throw new BadRequestException(
            `تحديث فشل: البضاعة المطلوبة غير متوفرة بالعدد والوزن الكافي`,
          );
        }

        let itemTotalPrice = parseFloat(
          (
            soldNetWeight *
            (newItemDto.goldPriceToday + newItemDto.makingChargesPerGram)
          ).toFixed(2),
        );
        let finalMakingChargesPerGram = newItemDto.makingChargesPerGram;

        if (
          newItemDto.itemTotalPrice !== undefined &&
          newItemDto.itemTotalPrice !== null
        ) {
          itemTotalPrice = parseFloat(newItemDto.itemTotalPrice.toFixed(2));
          finalMakingChargesPerGram = parseFloat(
            (
              itemTotalPrice / soldNetWeight -
              newItemDto.goldPriceToday
            ).toFixed(2),
          );
        }

        calculatedSumTotalPrice += itemTotalPrice;

        preparedItems.push({
          itemDto: newItemDto,
          dbItem,
          totalCalculatedTagWeight,
          soldNetWeight,
          makingChargesPerGram: finalMakingChargesPerGram,
          itemTotalPrice,
        });
      }

      const hasGlobalOverride =
        updateInvoiceDto.totalPrice !== undefined &&
        updateInvoiceDto.totalPrice !== null;

      const finalInvoiceTotalPrice: number = hasGlobalOverride
        ? (updateInvoiceDto.totalPrice ?? calculatedSumTotalPrice)
        : calculatedSumTotalPrice;

      const processedItems: IProcessedItem[] = [];
      let totalInvoiceGrossWeight = 0;
      let totalInvoiceNetWeight = 0;

      for (const prep of preparedItems) {
        const {
          itemDto: newItemDto,
          totalCalculatedTagWeight,
          soldNetWeight,
        } = prep;
        let { makingChargesPerGram, itemTotalPrice } = prep;

        const dbItem: any = await this.inventoryModel
          .findById(newItemDto.inventoryItem)
          .exec();

        if (hasGlobalOverride && calculatedSumTotalPrice > 0) {
          itemTotalPrice = parseFloat(
            (
              itemTotalPrice *
              (finalInvoiceTotalPrice / calculatedSumTotalPrice)
            ).toFixed(2),
          );
          makingChargesPerGram = parseFloat(
            (
              itemTotalPrice / soldNetWeight -
              newItemDto.goldPriceToday
            ).toFixed(2),
          );
        }

        const updatedTagDetails = [...(dbItem.tagDetails || [])];
        if (newItemDto.hasTag && updatedTagDetails.length > 0) {
          let neededCount = newItemDto.soldCount;
          for (let i = updatedTagDetails.length - 1; i >= 0; i--) {
            if (neededCount <= 0) break;
            if (updatedTagDetails[i].count <= neededCount) {
              neededCount -= updatedTagDetails[i].count;
              updatedTagDetails.splice(i, 1);
            } else {
              updatedTagDetails[i].count -= neededCount;
              updatedTagDetails.slice(i, 1);
              neededCount = 0;
            }
          }
        }

        let remainingTagsWeight = 0;
        for (const tag of updatedTagDetails) {
          remainingTagsWeight += tag.count * tag.weight;
        }
        const newTotalGrossWeight = parseFloat(
          (dbItem.totalGrossWeight - newItemDto.soldGrossWeight).toFixed(3),
        );
        const newTotalNetWeight = parseFloat(
          (newTotalGrossWeight - remainingTagsWeight).toFixed(3),
        );

        await this.inventoryModel.updateOne(
          { _id: newItemDto.inventoryItem },
          {
            $set: {
              currentCount: dbItem.currentCount - newItemDto.soldCount,
              totalGrossWeight: newTotalGrossWeight,
              totalNetWeight: newTotalNetWeight,
              tagDetails: updatedTagDetails,
            },
          },
        );

        processedItems.push({
          inventoryItem: new Types.ObjectId(newItemDto.inventoryItem),
          soldCount: newItemDto.soldCount,
          soldGrossWeight: newItemDto.soldGrossWeight,
          soldNetWeight,
          hasTag: newItemDto.hasTag,
          goldPriceToday: newItemDto.goldPriceToday,
          makingChargesPerGram,
          itemTotalPrice,
        });

        totalInvoiceGrossWeight += newItemDto.soldGrossWeight;
        totalInvoiceNetWeight += soldNetWeight;
      }

      oldInvoice.items = processedItems as any;
      oldInvoice.totalInvoiceGrossWeight = parseFloat(
        totalInvoiceGrossWeight.toFixed(3),
      );
      oldInvoice.totalInvoiceNetWeight = parseFloat(
        totalInvoiceNetWeight.toFixed(3),
      );
      oldInvoice.totalPrice = finalInvoiceTotalPrice;
    }

    const updatedInvoice = await oldInvoice.save();

    // 💰 [موازنة الدرج الذكية] حساب فرق السعر وتحديث الخزنة ديناميكياً
    const newPrice = updatedInvoice.totalPrice;
    const diff = parseFloat((newPrice - oldPrice).toFixed(2));

    if (diff > 0) {
      // الفاتورة قيمتها زادت -> العميل دفع زيادة يدخل الخزنة
      await this.safeService.triggerTransaction(
        diff,
        'INFLOW',
        `تعديل فاتورة بيع رقم #${updatedInvoice.invoiceNumber} (زيادة قيمة الفاتورة الكلية)`,
        userId,
      );
    } else if (diff < 0) {
      // الفاتورة قيمتها قلت -> المحل رجع فلوس للزبون تخرج من الخزنة
      await this.safeService.triggerTransaction(
        Math.abs(diff),
        'OUTFLOW',
        `تعديل فاتورة بيع رقم #${updatedInvoice.invoiceNumber} (تخفيض قيمة الفاتورة وارتجاع فروق نقدية)`,
        userId,
      );
    }

    return updatedInvoice.populate([
      { path: 'customer', select: 'fullName phoneNumber' },
      { path: 'items.inventoryItem', select: 'title karat companyName' },
      { path: 'soldBy', select: 'fullName role' },
    ]);
  }

  // ─── 3. إلغاء الفاتورة بالكامل وتصفير كاش الخزنة ───
  async cancelInvoice(id: string, userId: string): Promise<Invoice> {
    const invoice = await this.invoiceModel.findById(id).exec();
    if (!invoice) throw new NotFoundException('الفاتورة غير موجودة');
    if (invoice.status === 'CANCELLED')
      throw new BadRequestException('الملف ملغي سلفاً');

    // الاحتفاظ بالقيمة الإجمالية قبل تصفيرها لسحبها من الخزينة
    const priceToRefund = invoice.totalPrice;

    for (const item of invoice.items) {
      const dbItem: any = await this.inventoryModel
        .findById(item.inventoryItem)
        .exec();
      if (dbItem) {
        const restoredCount = dbItem.currentCount + item.soldCount;
        const restoredGrossWeight = parseFloat(
          (dbItem.totalGrossWeight + item.soldGrossWeight).toFixed(3),
        );

        const updatedTagDetails = [...(dbItem.tagDetails || [])];
        if (item.hasTag) {
          const estimatedTagWeight =
            item.soldNetWeight > 0
              ? parseFloat(
                  (
                    (item.soldGrossWeight - item.soldNetWeight) /
                    item.soldCount
                  ).toFixed(3),
                )
              : 0.06;
          updatedTagDetails.unshift({
            count: item.soldCount,
            weight: estimatedTagWeight,
          });
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

        await this.movementsService.logMovement({
          inventoryItem: item.inventoryItem.toString(),
          type: 'INVENTORY_IN',
          countChange: item.soldCount,
          grossWeightChange: item.soldGrossWeight,
          netWeightChange: item.soldNetWeight,
          actionBy: userId,
          reason: `إلغاء فاتورة بيع رقم: ${invoice.invoiceNumber} وإعادة (${item.soldCount}) قطع للمخزن`,
        });
      }
    }

    invoice.status = 'CANCELLED';
    invoice.totalPrice = 0;
    invoice.totalInvoiceGrossWeight = 0;
    invoice.totalInvoiceNetWeight = 0;

    const cancelledInvoice = await invoice.save();

    // 💰 [تحديث الخزنة تلقائياً] سحب فلوس الفاتورة بالكامل من الدرج وإرجاعها للعميل
    if (priceToRefund > 0) {
      await this.safeService.triggerTransaction(
        priceToRefund,
        'OUTFLOW',
        `إلغاء فاتورة البيع رقم #${cancelledInvoice.invoiceNumber} وارتجاع النقدية بالكامل للعميل`,
        userId,
      );
    }

    return cancelledInvoice;
  }

  // ─── 4. سجل الفواتير مع إظهار جميع الفواتير للجميع بدون فلترة ───
  async findAllInvoices(
    query: {
      status?: string;
      invoiceNumber?: string;
      customerName?: string;
      customerPhone?: string;
    },
    userId: string,
    userRole: string,
  ): Promise<Invoice[]> {
    const filter: any = {};
    if (query.status) filter.status = query.status.toUpperCase();
    if (query.invoiceNumber)
      filter.invoiceNumber = { $regex: query.invoiceNumber, $options: 'i' };

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

    // ⛔ تم إيقاف شرط الفلترة أدناه لكي يتم جلب جميع فواتير النظام لجميع الموظفين والملاك على حد سواء
    // if (userRole !== 'OWNER') {
    //   filter.soldBy = new Types.ObjectId(userId);
    // }

    return this.invoiceModel
      .find(filter)
      .populate('customer', 'fullName phoneNumber')
      .populate('items.inventoryItem', 'title karat companyName')
      .populate('soldBy', 'fullName role')
      .sort({ createdAt: -1 })
      .exec();
  }
}
