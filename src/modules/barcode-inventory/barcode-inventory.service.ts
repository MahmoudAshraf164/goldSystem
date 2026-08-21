import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  BarcodeInventory,
  BarcodeInventoryDocument,
} from './schemas/barcode-inventory.schema';
import { CreateBarcodeItemDto } from './dto/create-barcode-item.dto';
import { StockMovementsService } from '../stock-movements/stock-movements.service';
import * as bwipjs from 'bwip-js';

@Injectable()
export class BarcodeInventoryService {
  constructor(
    @InjectModel(BarcodeInventory.name)
    private readonly barcodeInventoryModel: Model<BarcodeInventoryDocument>,
    private readonly movementsService: StockMovementsService,
  ) {}

  // دالة لتوليد باركود فريد تلقائياً مثل JWL-21-10001
  private async generateUniqueBarcode(karat: number): Promise<string> {
    const prefix = `JWL-${karat}`;
    const count = await this.barcodeInventoryModel.countDocuments().exec();
    const nextSequence = (count + 1).toString().padStart(5, '0');
    return `${prefix}-${nextSequence}`;
  }

  // 1. إضافة قطعة ذهب جديدة بباركود
  async createItem(
    dto: CreateBarcodeItemDto,
    userId: string,
  ): Promise<BarcodeInventory> {
    const tagWeight = dto.tagWeight ?? 0.06;
    const netWeight = parseFloat((dto.grossWeight - tagWeight).toFixed(3));

    if (netWeight <= 0) {
      throw new BadRequestException(
        'الوزن الصافي الناتج أقل من أو يساوي صفر! يرجى مراجعة الوزن القائم ووزن التيكت.',
      );
    }

    // توليد الباركود إذا لم يتم تمريره
    const finalBarcode =
      dto.barcode && dto.barcode.trim() !== ''
        ? dto.barcode.trim()
        : await this.generateUniqueBarcode(dto.karat);

    // التحقق من عدم تكرار الباركود
    const existing = await this.barcodeInventoryModel
      .findOne({ barcode: finalBarcode })
      .exec();
    if (existing) {
      throw new ConflictException('رمز الباركود هذا مستخدم بالفعل لقطعة أخرى');
    }

    const newItem = new this.barcodeInventoryModel({
      ...dto,
      barcode: finalBarcode,
      tagWeight,
      netWeight,
      companyName:
        dto.companyName && dto.companyName.trim() !== ''
          ? dto.companyName
          : '-',
      status: 'AVAILABLE',
    });

    const saved = await newItem.save();

    // تسجيل الحركة في سجل السحوبات والدخول
    await this.movementsService.logMovement({
      inventoryItem: saved._id.toString(),
      type: 'INVENTORY_IN',
      countChange: 1,
      grossWeightChange: saved.grossWeight,
      netWeightChange: saved.netWeight,
      actionBy: userId,
      reason: `إدخال قطعة جديدة بالباركود [${saved.barcode}] - ${saved.title} عيار ${saved.karat}`,
    });

    return saved;
  }

  // 2. البحث عن قطعة بالباركود (قراءة السكانر المباشرة)
  async findByBarcode(barcode: string): Promise<BarcodeInventory> {
    const item = await this.barcodeInventoryModel
      .findOne({ barcode: barcode.trim(), isArchived: false })
      .populate('category', 'name')
      .exec();

    if (!item) {
      throw new NotFoundException(
        `القطعة ذات الباركود (${barcode}) غير موجودة`,
      );
    }

    if (item.status === 'SOLD') {
      throw new BadRequestException(`القطعة رقم (${barcode}) مباعة بالفعل!`);
    }

    return item;
  }

  // 3. جلب جميع القطع المتاحة في مخزون الباركود
  async findAllAvailable(karat?: number): Promise<BarcodeInventory[]> {
    const filter: any = { status: 'AVAILABLE', isArchived: false };
    if (karat) filter.karat = karat;

    return this.barcodeInventoryModel
      .find(filter)
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .exec();
  }

  // 4. تعديل بيانات قطعة ذهب بالباركود
  async updateItem(
    id: string,
    updateDto: Partial<CreateBarcodeItemDto>,
    userId: string,
  ): Promise<BarcodeInventory> {
    const item = await this.barcodeInventoryModel
      .findOne({ _id: id, isArchived: false })
      .exec();

    if (!item) {
      throw new NotFoundException('القطعة المطلوبة غير موجودة أو مؤرشفة');
    }

    if (item.status === 'SOLD') {
      throw new BadRequestException('لا يمكن تعديل قطعة مباعة بالفعل!');
    }

    const grossWeight = updateDto.grossWeight ?? item.grossWeight;
    const tagWeight = updateDto.tagWeight ?? item.tagWeight;
    const netWeight = parseFloat((grossWeight - tagWeight).toFixed(3));

    if (netWeight <= 0) {
      throw new BadRequestException(
        'الوزن الصافي الناتج أقل من أو يساوي صفر! يرجى مراجعة الوزن القائم ووزن التيكت.',
      );
    }

    // حساب فروق الأوزان لتدوينها في حركة المخزون
    const weightDiffGross = parseFloat(
      (grossWeight - item.grossWeight).toFixed(3),
    );
    const weightDiffNet = parseFloat((netWeight - item.netWeight).toFixed(3));

    const updatedItem = await this.barcodeInventoryModel
      .findByIdAndUpdate(
        id,
        {
          ...updateDto,
          grossWeight,
          tagWeight,
          netWeight,
          companyName:
            updateDto.companyName !== undefined
              ? updateDto.companyName.trim() || '-'
              : item.companyName,
        },
        { new: true },
      )
      .populate('category', 'name')
      .exec();

    if (!updatedItem) {
      throw new NotFoundException('القطعة المطلوبة غير موجودة');
    }

    // تسجيل حركة التعديل إذا تغيرت الأوزان
    if (weightDiffGross !== 0 || weightDiffNet !== 0) {
      await this.movementsService.logMovement({
        inventoryItem: updatedItem._id.toString(),
        type: 'INVENTORY_IN',
        countChange: 0,
        grossWeightChange: weightDiffGross,
        netWeightChange: weightDiffNet,
        actionBy: userId,
        reason: `تعديل أوزان القطعة بالباركود [${updatedItem.barcode}] - ${updatedItem.title}`,
      });
    }

    return updatedItem;
  }

  // 5. الحذف الناعم (Soft Delete / أرشفة القطعة)
  async softDelete(id: string, userId: string): Promise<void> {
    const item = await this.barcodeInventoryModel
      .findOne({ _id: id, isArchived: false })
      .exec();

    if (!item) {
      throw new NotFoundException(
        'القطعة المطلوبة غير موجودة أو مؤرشفة بالفعل',
      );
    }

    if (item.status === 'SOLD') {
      throw new BadRequestException(
        'لا يمكن أرشفة قطعة تم بيعها وسجلت في فواتير المبيعات!',
      );
    }

    await this.barcodeInventoryModel
      .updateOne({ _id: id }, { isArchived: true })
      .exec();

    // تسكيل حركة الخروج/الأرشفة
    await this.movementsService.logMovement({
      inventoryItem: item._id.toString(),
      type: 'SALE_OUT',
      countChange: -1,
      grossWeightChange: -item.grossWeight,
      netWeightChange: -item.netWeight,
      actionBy: userId,
      reason: `أرشفة/حذف قطعة الباركود [${item.barcode}] - ${item.title}`,
    });
  }

  // 6. جلب جميع القطع المؤرشفة (سلة المهملات/الأرشيف)
  async findAllArchived(): Promise<BarcodeInventory[]> {
    return this.barcodeInventoryModel
      .find({ isArchived: true })
      .populate('category', 'name')
      .sort({ updatedAt: -1 })
      .exec();
  }

  /**
   * 🖨️ دالة لتوليد صورة الباركود بصيغة Base64 PNG جاهزة للطباعة أو العرض في الـ Frontend
   */
  async generateBarcodeImage(
    barcode: string,
  ): Promise<{ barcode: string; imageBase64: string }> {
    const item = await this.findByBarcode(barcode);

    try {
      const pngBuffer = await bwipjs.toBuffer({
        bcid: 'code128', // نوع الباركود المعياري
        text: item.barcode, // النص المكتوب تحت الباركود
        scale: 3, // دقة الصورة
        height: 10, // ارتفاع الأشرطة
        includetext: true, // إظهار النص تحت الأشرطة
        textxalign: 'center',
      });

      const imageBase64 = `data:image/png;base64,${pngBuffer.toString('base64')}`;

      return {
        barcode: item.barcode,
        imageBase64,
      };
    } catch (error) {
      throw new BadRequestException('فشل في توليد صورة الباركود للقطعة');
    }
  }
}
