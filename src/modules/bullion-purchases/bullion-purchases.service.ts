import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  BullionPurchase,
  BullionPurchaseStatus,
} from './schemas/bullion-purchase.schema';
import { BullionInventory } from '../bullion-inventory/schemas/bullion-inventory.schema';
import { Customer } from '../customers/schemas/customer.schema';
import { StockMovementsService } from '../stock-movements/stock-movements.service';
import { CreateBullionPurchaseDto } from './dto/create-bullion-purchase.dto';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class BullionPurchasesService {
  constructor(
    @InjectModel(BullionPurchase.name)
    private readonly purchaseModel: Model<BullionPurchase>,
    @InjectModel(BullionInventory.name)
    private readonly bullionModel: Model<BullionInventory>,
    @InjectModel(Customer.name)
    private readonly customerModel: Model<Customer>,
    private readonly movementsService: StockMovementsService,
  ) {}

  // ─── مساعد للتحقق من الملكية والصلاحية ───
  private validateOwnership(purchase: BullionPurchase, user: any) {
    const userId = user.id || user._id;
    const isOwner = user.role === Role.OWNER;
    const isBuyer = purchase.buyer.toString() === userId.toString();

    if (!isOwner && !isBuyer) {
      throw new ForbiddenException(
        'غير مصرح لك بالوصول أو التعديل على فاتورة شراء خاصة بموظف آخر',
      );
    }
  }

  // ─── 1. إنشاء فاتورة شراء/مرتجع سبايك من عميل ───
  async createPurchaseInvoice(
    dto: CreateBullionPurchaseDto,
    buyerId: string,
  ): Promise<BullionPurchase> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('يجب إضافة صنف واحد على الأقل بالفاتورة');
    }

    const customer = await this.customerModel.findById(dto.customerId).exec();
    if (!customer) {
      throw new NotFoundException('العميل المحدد غير موجود بالنظام');
    }

    let totalGoldWeight = 0;
    let totalCashbackPaid = 0;
    let grandTotal = 0;
    const processedItems: Record<string, any>[] = [];

    for (const itemDto of dto.items) {
      const bullion = await this.bullionModel
        .findById(itemDto.bullionItem)
        .exec();
      if (!bullion) {
        throw new NotFoundException(
          `السبيكة/الجنيه رقم ${itemDto.bullionItem} غير موجودة بالمخزن`,
        );
      }

      // تحديد قيمة الكاش باك (إما من الموزع أو القيمة المسجلة للمنتج)
      const cashbackPerUnit =
        itemDto.cashbackPerUnit !== undefined
          ? itemDto.cashbackPerUnit
          : bullion.cashbackPerUnit || 0;

      const itemGoldWeight = parseFloat(
        (bullion.weightPerUnit * itemDto.quantity).toFixed(3),
      );
      const itemTotalGoldPrice = itemGoldWeight * itemDto.buyGoldPricePerGram;
      const itemTotalCashback = cashbackPerUnit * itemDto.quantity;
      const itemGrandTotal = itemTotalGoldPrice + itemTotalCashback;

      totalGoldWeight += itemGoldWeight;
      totalCashbackPaid += itemTotalCashback;
      grandTotal += itemGrandTotal;

      processedItems.push({
        bullionItem: bullion._id,
        title: `${bullion.title} (${bullion.companyName})`,
        karat: bullion.karat,
        weightPerUnit: bullion.weightPerUnit,
        quantity: itemDto.quantity,
        buyGoldPricePerGram: itemDto.buyGoldPricePerGram,
        cashbackPerUnit,
        itemTotalGoldPrice: parseFloat(itemTotalGoldPrice.toFixed(2)),
        itemTotalCashback: parseFloat(itemTotalCashback.toFixed(2)),
        itemGrandTotal: parseFloat(itemGrandTotal.toFixed(2)),
      });
    }

    const count = await this.purchaseModel.countDocuments();
    const invoiceNumber = `BP-${1001 + count}`;

    const newPurchase = new this.purchaseModel({
      invoiceNumber,
      customer: new Types.ObjectId(dto.customerId),
      items: processedItems,
      totalGoldWeight: parseFloat(totalGoldWeight.toFixed(3)),
      totalCashbackPaid: parseFloat(totalCashbackPaid.toFixed(2)),
      grandTotal: parseFloat(grandTotal.toFixed(2)),
      buyer: new Types.ObjectId(buyerId),
      notes: dto.notes,
    });

    const savedPurchase = await newPurchase.save();

    const customerName =
      (customer as any).fullName || (customer as any).name || 'عميل';

    // زيادة الكميات بالمخزن وتسجيل الحركة
    for (const item of processedItems) {
      await this.bullionModel.findByIdAndUpdate(item.bullionItem, {
        $inc: { quantity: item.quantity },
      });

      const totalItemWeight = item.weightPerUnit * item.quantity;

      await this.movementsService.logMovement({
        inventoryItem: item.bullionItem.toString(),
        type: 'BULLION_BUYBACK_IN' as any,
        countChange: item.quantity,
        grossWeightChange: totalItemWeight,
        netWeightChange: totalItemWeight,
        actionBy: buyerId,
        reason: `شراء/مرتجع سبايك من العميل: ${customerName} (فاتورة رقم: ${invoiceNumber})`,
      });
    }

    return savedPurchase;
  }

  // ─── 2. جلب جميع فواتير الشراء (فلترة بالدور) ───
  async findAllInvoices(
    user: any,
    query?: { status?: BullionPurchaseStatus; search?: string },
  ): Promise<BullionPurchase[]> {
    const filter: any = {};

    if (user.role !== Role.OWNER) {
      const userId = user.id || user._id;
      filter.buyer = new Types.ObjectId(userId);
    }

    if (query?.status) filter.status = query.status;

    return this.purchaseModel
      .find(filter)
      .populate('customer', 'fullName name phone nationalId email')
      .populate('buyer', 'fullName role')
      .sort({ createdAt: -1 })
      .exec();
  }

  // ─── 3. جلب فاتورة شراء محددة ───
  async findOneInvoice(id: string, user: any): Promise<BullionPurchase> {
    const purchase = await this.purchaseModel
      .findById(id)
      .populate('customer', 'fullName name phone nationalId email')
      .populate('buyer', 'fullName role')
      .exec();

    if (!purchase) throw new NotFoundException('فاتورة الشراء غير موجودة');

    this.validateOwnership(purchase, user);

    return purchase;
  }

  // ─── 4. إلغاء فاتورة شراء وإعادة سحب القطع من المخزن ───
  async cancelInvoice(
    id: string,
    user: any,
    reason?: string,
  ): Promise<BullionPurchase> {
    const purchase = await this.purchaseModel.findById(id).exec();
    if (!purchase) throw new NotFoundException('الفاتورة غير موجودة');

    this.validateOwnership(purchase, user);

    if (purchase.status === BullionPurchaseStatus.CANCELLED) {
      throw new BadRequestException('الفاتورة ملغاة بالفعل مسبقاً');
    }

    const userId = user.id || user._id;

    // التأكد أولاً أن المخزون يسمح بسحب القطع التي أضيفت سابقاً
    for (const item of purchase.items) {
      const bullion = await this.bullionModel.findById(item.bullionItem).exec();
      if (!bullion || bullion.quantity < item.quantity) {
        throw new BadRequestException(
          `لا يمكن إلغاء الفاتورة لأن كمية القطعة "${item.title}" في المخزن أقل من الكمية المشتراة مسبقاً.`,
        );
      }
    }

    purchase.status = BullionPurchaseStatus.CANCELLED;
    const updatedPurchase = await purchase.save();

    for (const item of purchase.items) {
      await this.bullionModel.findByIdAndUpdate(item.bullionItem, {
        $inc: { quantity: -item.quantity },
      });

      const totalItemWeight = item.weightPerUnit * item.quantity;

      await this.movementsService.logMovement({
        inventoryItem: item.bullionItem.toString(),
        type: 'BULLION_BUYBACK_CANCEL_OUT' as any,
        countChange: -item.quantity,
        grossWeightChange: -totalItemWeight,
        netWeightChange: -totalItemWeight,
        actionBy: userId,
        reason:
          reason || `إلغاء فاتورة شراء سبايك رقم: ${purchase.invoiceNumber}`,
      });
    }

    return updatedPurchase;
  }
}
