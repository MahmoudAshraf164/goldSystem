import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BullionSale, BullionSaleStatus } from './schemas/bullion-sale.schema';
import { BullionInventory } from '../bullion-inventory/schemas/bullion-inventory.schema';
import { Customer } from '../customers/schemas/customer.schema';
import { StockMovementsService } from '../stock-movements/stock-movements.service';
import { CreateBullionSaleDto } from './dto/create-bullion-sale.dto';
import { UpdateBullionSaleDto } from './dto/update-bullion-sale.dto';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class BullionSalesService {
  constructor(
    @InjectModel(BullionSale.name)
    private readonly saleModel: Model<BullionSale>,
    @InjectModel(BullionInventory.name)
    private readonly bullionModel: Model<BullionInventory>,
    @InjectModel(Customer.name)
    private readonly customerModel: Model<Customer>,
    private readonly movementsService: StockMovementsService,
  ) {}

  // ─── مساعد داخلي لفحص الصلاحيات ───
  private validateOwnership(sale: BullionSale, user: any) {
    const userId = user.id || user._id;
    const isOwner = user.role === Role.OWNER;
    const isSeller = sale.seller.toString() === userId.toString();

    if (!isOwner && !isSeller) {
      throw new ForbiddenException(
        'غير مصرح لك بالوصول أو التعديل على فاتورة خاصة بموظف آخر',
      );
    }
  }

  // ─── 1. إصدار فاتورة بيع سبايك جديدة ───
  async createSaleInvoice(
    dto: CreateBullionSaleDto,
    sellerId: string,
  ): Promise<BullionSale> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('يجب إضافة صنف واحد على الأقل بالفاتورة');
    }

    const customer = await this.customerModel.findById(dto.customerId).exec();
    if (!customer) {
      throw new NotFoundException('العميل المحدد غير موجود بالنظام');
    }

    let totalGoldWeight = 0;
    let totalMakingCharges = 0;
    let grandTotal = 0;
    const processedItems: Record<string, any>[] = [];

    for (const itemDto of dto.items) {
      const bullion = await this.bullionModel
        .findById(itemDto.bullionItem)
        .exec();
      if (!bullion || bullion.isArchived) {
        throw new NotFoundException(
          `السبيكة/الجنيه رقم ${itemDto.bullionItem} غير موجود بالمخزن`,
        );
      }

      if (bullion.quantity < itemDto.quantity) {
        throw new BadRequestException(
          `الكمية المتاحة في المخزن من "${bullion.title}" غير كافية. المتاح: ${bullion.quantity}`,
        );
      }

      const makingCharge =
        itemDto.makingChargePerUnit !== undefined
          ? itemDto.makingChargePerUnit
          : bullion.makingChargePerUnit;

      const itemGoldWeight = parseFloat(
        (bullion.weightPerUnit * itemDto.quantity).toFixed(3),
      );
      const itemGoldPrice = itemGoldWeight * itemDto.goldPricePerGram;
      const itemMakingTotal = makingCharge * itemDto.quantity;
      const itemTotalPrice = itemGoldPrice + itemMakingTotal;

      totalGoldWeight += itemGoldWeight;
      totalMakingCharges += itemMakingTotal;
      grandTotal += itemTotalPrice;

      processedItems.push({
        bullionItem: bullion._id,
        title: `${bullion.title} (${bullion.companyName})`,
        karat: bullion.karat,
        weightPerUnit: bullion.weightPerUnit,
        quantity: itemDto.quantity,
        goldPricePerGram: itemDto.goldPricePerGram,
        makingChargePerUnit: makingCharge,
        itemTotalPrice: parseFloat(itemTotalPrice.toFixed(2)),
      });
    }

    const invoiceCount = await this.saleModel.countDocuments();
    const invoiceNumber = `BS-${1001 + invoiceCount}`;

    const newInvoice = new this.saleModel({
      invoiceNumber,
      customer: new Types.ObjectId(dto.customerId),
      items: processedItems,
      totalGoldWeight: parseFloat(totalGoldWeight.toFixed(3)),
      totalMakingCharges: parseFloat(totalMakingCharges.toFixed(2)),
      grandTotal: parseFloat(grandTotal.toFixed(2)),
      paidAmount: parseFloat(grandTotal.toFixed(2)),
      seller: new Types.ObjectId(sellerId),
    });

    const savedInvoice = await newInvoice.save();

    const customerDisplayName =
      (customer as any).fullName || (customer as any).name || 'عميل';

    for (const item of processedItems) {
      await this.bullionModel.findByIdAndUpdate(item.bullionItem, {
        $inc: { quantity: -item.quantity },
      });

      const totalItemWeight = item.weightPerUnit * item.quantity;

      await this.movementsService.logMovement({
        inventoryItem: item.bullionItem.toString(),
        type: 'BULLION_SALE_OUT' as any,
        countChange: -item.quantity,
        grossWeightChange: -totalItemWeight,
        netWeightChange: -totalItemWeight,
        actionBy: sellerId,
        reason: `فاتورة بيع سبايك رقم: ${invoiceNumber} للعميل: ${customerDisplayName}`,
      });
    }

    return savedInvoice;
  }

  // ─── 2. جلب الفواتير (الكل للمالك / فواتير الموظف فقط للموظف) ───
  async findAllInvoices(
    user: any,
    query?: { status?: BullionSaleStatus; search?: string },
  ): Promise<BullionSale[]> {
    const filter: any = {};

    // 👈 إذا لم يكن المالك (أي موظف)، يرى فقط الفواتير التي أصدرها
    if (user.role !== Role.OWNER) {
      const userId = user.id || user._id;
      filter.seller = new Types.ObjectId(userId);
    }

    if (query?.status) filter.status = query.status;

    return this.saleModel
      .find(filter)
      .populate('customer', 'fullName name phone nationalId email')
      .populate('seller', 'fullName role')
      .sort({ createdAt: -1 })
      .exec();
  }

  // ─── 3. جلب فاتورة محددة بالـ ID ───
  async findOneInvoice(id: string, user: any): Promise<BullionSale> {
    const sale = await this.saleModel
      .findById(id)
      .populate('customer', 'fullName name phone nationalId email')
      .populate('seller', 'fullName role')
      .exec();

    if (!sale) throw new NotFoundException('فاتورة السبايك غير موجودة');

    // 👈 التحقق من الملكية
    this.validateOwnership(sale, user);

    return sale;
  }

  // ─── 4. تعديل فاتورة بيع سبايك ───
  async updateSaleInvoice(
    id: string,
    dto: UpdateBullionSaleDto,
    user: any,
  ): Promise<BullionSale> {
    const sale = await this.saleModel.findById(id).exec();
    if (!sale) {
      throw new NotFoundException('الفاتورة غير موجودة');
    }

    // 👈 التحقق من الصلاحيات
    this.validateOwnership(sale, user);

    if (sale.status === BullionSaleStatus.CANCELLED) {
      throw new BadRequestException('لا يمكن تعديل فاتورة ملغاة');
    }

    const userId = user.id || user._id;

    if (dto.customerId) {
      const customer = await this.customerModel.findById(dto.customerId).exec();
      if (!customer) throw new NotFoundException('العميل المحدد غير موجود');
      sale.customer = new Types.ObjectId(dto.customerId);
    }

    if (dto.items && dto.items.length > 0) {
      for (const oldItem of sale.items) {
        await this.bullionModel.findByIdAndUpdate(oldItem.bullionItem, {
          $inc: { quantity: oldItem.quantity },
        });
      }

      let totalGoldWeight = 0;
      let totalMakingCharges = 0;
      let grandTotal = 0;
      const processedItems: Record<string, any>[] = [];

      for (const itemDto of dto.items) {
        const bullion = await this.bullionModel
          .findById(itemDto.bullionItem)
          .exec();
        if (!bullion || bullion.isArchived) {
          throw new NotFoundException(`السبيكة/الجنيه غير موجود بالمخزن`);
        }

        if (bullion.quantity < itemDto.quantity) {
          throw new BadRequestException(
            `الكمية المتاحة في المخزن من "${bullion.title}" غير كافية للتعديل. المتاح: ${bullion.quantity}`,
          );
        }

        const makingCharge =
          itemDto.makingChargePerUnit !== undefined
            ? itemDto.makingChargePerUnit
            : bullion.makingChargePerUnit;

        const itemGoldWeight = parseFloat(
          (bullion.weightPerUnit * itemDto.quantity).toFixed(3),
        );
        const itemGoldPrice = itemGoldWeight * itemDto.goldPricePerGram;
        const itemMakingTotal = makingCharge * itemDto.quantity;
        const itemTotalPrice = itemGoldPrice + itemMakingTotal;

        totalGoldWeight += itemGoldWeight;
        totalMakingCharges += itemMakingTotal;
        grandTotal += itemTotalPrice;

        processedItems.push({
          bullionItem: bullion._id,
          title: `${bullion.title} (${bullion.companyName})`,
          karat: bullion.karat,
          weightPerUnit: bullion.weightPerUnit,
          quantity: itemDto.quantity,
          goldPricePerGram: itemDto.goldPricePerGram,
          makingChargePerUnit: makingCharge,
          itemTotalPrice: parseFloat(itemTotalPrice.toFixed(2)),
        });

        await this.bullionModel.findByIdAndUpdate(itemDto.bullionItem, {
          $inc: { quantity: -itemDto.quantity },
        });

        const oldItemMatch = sale.items.find(
          (i) => i.bullionItem.toString() === itemDto.bullionItem,
        );
        const oldQty = oldItemMatch ? oldItemMatch.quantity : 0;
        const qtyDiff = itemDto.quantity - oldQty;

        if (qtyDiff !== 0) {
          const weightDiff = parseFloat(
            (bullion.weightPerUnit * qtyDiff).toFixed(3),
          );
          await this.movementsService.logMovement({
            inventoryItem: bullion._id.toString(),
            type: (qtyDiff < 0
              ? 'BULLION_UPDATE_RETURN'
              : 'BULLION_UPDATE_OUT') as any,
            countChange: -qtyDiff,
            grossWeightChange: -weightDiff,
            netWeightChange: -weightDiff,
            actionBy: userId,
            reason: `تعديل فاتورة السبايك رقم: ${sale.invoiceNumber} (تعديل كمية من ${oldQty} إلى ${itemDto.quantity})`,
          });
        }
      }

      sale.items = processedItems as any;
      sale.totalGoldWeight = parseFloat(totalGoldWeight.toFixed(3));
      sale.totalMakingCharges = parseFloat(totalMakingCharges.toFixed(2));
      sale.grandTotal = parseFloat(grandTotal.toFixed(2));
      sale.paidAmount = parseFloat(grandTotal.toFixed(2));
    }

    return await sale.save();
  }

  // ─── 5. إلغاء الفاتورة ───
  async cancelInvoice(
    id: string,
    user: any,
    reason?: string,
  ): Promise<BullionSale> {
    const sale = await this.saleModel.findById(id).exec();
    if (!sale) throw new NotFoundException('الفاتورة غير موجودة');

    // 👈 التحقق من الصلاحيات
    this.validateOwnership(sale, user);

    if (sale.status === BullionSaleStatus.CANCELLED) {
      throw new BadRequestException('الفاتورة ملغاة بالفعل مسبقاً');
    }

    const userId = user.id || user._id;
    sale.status = BullionSaleStatus.CANCELLED;
    const updatedSale = await sale.save();

    for (const item of sale.items) {
      await this.bullionModel.findByIdAndUpdate(item.bullionItem, {
        $inc: { quantity: item.quantity },
      });

      const totalItemWeight = item.weightPerUnit * item.quantity;

      await this.movementsService.logMovement({
        inventoryItem: item.bullionItem.toString(),
        type: 'BULLION_CANCEL_RETURN' as any,
        countChange: item.quantity,
        grossWeightChange: totalItemWeight,
        netWeightChange: totalItemWeight,
        actionBy: userId,
        reason: reason || `إلغاء فاتورة بيع السبايك رقم: ${sale.invoiceNumber}`,
      });
    }

    return updatedSale;
  }
}
