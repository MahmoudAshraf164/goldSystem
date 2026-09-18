import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  BarcodeInventory,
  BarcodeInventoryDocument,
} from './schemas/barcode-inventory.schema';
import {
  Inventory,
  InventoryDocument,
  TagDetail,
} from '../inventory/schemas/inventory.schema';
import { CreateBarcodeItemDto } from './dto/create-barcode-item.dto';
import { UpdateBarcodeItemDto } from './dto/update-barcode-item.dto';
import { StockMovementsService } from '../stock-movements/stock-movements.service';
import * as bwipjs from 'bwip-js';

@Injectable()
export class BarcodeInventoryService {
  constructor(
    @InjectModel(BarcodeInventory.name)
    private readonly barcodeInventoryModel: Model<BarcodeInventoryDocument>,
    @InjectModel(Inventory.name)
    private readonly inventoryModel: Model<InventoryDocument>,
    private readonly movementsService: StockMovementsService,
  ) {}

  private async generateUniqueBarcode(karat: number): Promise<string> {
    const currentYear = new Date().getFullYear().toString();
    const count = await this.barcodeInventoryModel.countDocuments().exec();
    const nextSequence = (count + 1).toString().padStart(5, '0');
    return `${karat}${currentYear}${nextSequence}`;
  }

  private updateTagDetailsList(
    existingTags: TagDetail[],
    targetWeight: number,
    countChange: number,
  ): TagDetail[] {
    const tags = existingTags
      ? existingTags.map((t) => ({ count: t.count, weight: t.weight }))
      : [];
    const normalizedWeight = Number(targetWeight.toFixed(3));

    const existingIndex = tags.findIndex(
      (t) => Number(t.weight.toFixed(3)) === normalizedWeight,
    );

    if (existingIndex > -1) {
      tags[existingIndex].count += countChange;
      if (tags[existingIndex].count <= 0) {
        tags.splice(existingIndex, 1);
      }
    } else if (countChange > 0) {
      tags.push({ count: countChange, weight: normalizedWeight });
    }

    return tags;
  }

  // 1. إضافة قطعة جديدة
  async createItem(
    dto: CreateBarcodeItemDto,
    userId: string,
    imageUrl: string | null = null,
  ): Promise<BarcodeInventory> {
    const tagWeight =
      dto.tagWeight !== undefined && dto.tagWeight !== null
        ? Number(dto.tagWeight)
        : 0.06;

    const netWeight = parseFloat((dto.grossWeight - tagWeight).toFixed(3));

    if (netWeight <= 0) {
      throw new BadRequestException('الوزن الصافي الناتج أقل من أو يساوي صفر!');
    }

    const finalBarcode =
      dto.barcode && dto.barcode.trim() !== ''
        ? dto.barcode.trim()
        : await this.generateUniqueBarcode(dto.karat);

    const existing = await this.barcodeInventoryModel
      .findOne({ barcode: finalBarcode })
      .exec();
    if (existing) {
      throw new ConflictException('رمز الباركود هذا مستخدم بالفعل لقطعة أخرى');
    }

    const cleanedCompanyName =
      dto.companyName && dto.companyName.trim() !== ''
        ? dto.companyName.trim()
        : '-';

    let inventoryItem: InventoryDocument | null = null;

    if (dto.inventoryId) {
      inventoryItem = await this.inventoryModel
        .findOne({ _id: dto.inventoryId, isArchived: false })
        .exec();
    } else {
      const filter: any = {
        karat: dto.karat,
        companyName: cleanedCompanyName,
        isArchived: false,
      };
      if (dto.category) filter.category = new Types.ObjectId(dto.category);
      inventoryItem = await this.inventoryModel.findOne(filter).exec();
    }

    if (!inventoryItem) {
      inventoryItem = new this.inventoryModel({
        title: dto.title,
        companyName: cleanedCompanyName,
        category: dto.category ? new Types.ObjectId(dto.category) : null,
        karat: dto.karat,
        initialCount: 1,
        currentCount: 1,
        initialGrossWeight: dto.grossWeight,
        totalGrossWeight: dto.grossWeight,
        totalNetWeight: netWeight,
        tagDetails: tagWeight > 0 ? [{ count: 1, weight: tagWeight }] : [],
      });
    } else {
      inventoryItem.initialCount += 1;
      inventoryItem.currentCount += 1;
      inventoryItem.initialGrossWeight = parseFloat(
        (inventoryItem.initialGrossWeight + dto.grossWeight).toFixed(3),
      );
      inventoryItem.totalGrossWeight = parseFloat(
        (inventoryItem.totalGrossWeight + dto.grossWeight).toFixed(3),
      );
      inventoryItem.totalNetWeight = parseFloat(
        (inventoryItem.totalNetWeight + netWeight).toFixed(3),
      );

      if (tagWeight > 0) {
        inventoryItem.tagDetails = this.updateTagDetailsList(
          inventoryItem.tagDetails,
          tagWeight,
          1,
        );
      }
    }

    const savedInventory = await inventoryItem.save();

    const newItem = new this.barcodeInventoryModel({
      ...dto,
      barcode: finalBarcode,
      tagWeight,
      netWeight,
      imageUrl,
      companyName: cleanedCompanyName,
      status: 'AVAILABLE',
      inventoryRef: savedInventory._id,
    });

    const saved = await newItem.save();

    await this.movementsService.logMovement({
      inventoryItem: savedInventory._id.toString(),
      type: 'INVENTORY_IN',
      countChange: 1,
      grossWeightChange: saved.grossWeight,
      netWeightChange: saved.netWeight,
      actionBy: userId,
      reason: `إدخال قطعة باركود جديدة [${saved.barcode}] - ${saved.title}`,
    });

    return saved;
  }

  // 2. البحث بالباركود
  async findByBarcode(barcode: string): Promise<BarcodeInventory> {
    const item = await this.barcodeInventoryModel
      .findOne({ barcode: barcode.trim(), isArchived: false })
      .populate('category', 'name')
      .populate('inventoryRef')
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

  // 3. جلب القطع المتاحة
  async findAllAvailable(
    karat?: number,
    categoryId?: string,
  ): Promise<BarcodeInventory[]> {
    const filter: any = { status: 'AVAILABLE', isArchived: false };
    if (karat) filter.karat = karat;
    if (categoryId && Types.ObjectId.isValid(categoryId)) {
      filter.category = new Types.ObjectId(categoryId);
    }

    return this.barcodeInventoryModel
      .find(filter)
      .populate('category', 'name')
      .populate('inventoryRef')
      .sort({ createdAt: -1 })
      .exec();
  }

  // 4. تعديل قطعة بالباركود
  async updateItem(
    idOrBarcode: string,
    updateDto: UpdateBarcodeItemDto,
    userId: string,
    imageUrl: string | null = null,
  ): Promise<BarcodeInventory> {
    const isObjectId = Types.ObjectId.isValid(idOrBarcode);
    const query = isObjectId
      ? { _id: idOrBarcode, isArchived: false }
      : { barcode: idOrBarcode.trim(), isArchived: false };

    const item = await this.barcodeInventoryModel.findOne(query).exec();

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
      throw new BadRequestException('الوزن الصافي الناتج غير صالح!');
    }

    const updatedImageUrl = imageUrl ? imageUrl : item.imageUrl;

    const oldInvId = item.inventoryRef ? item.inventoryRef.toString() : null;
    const newInvId = updateDto.inventoryRef
      ? updateDto.inventoryRef.toString()
      : oldInvId;

    if (oldInvId && newInvId && oldInvId !== newInvId) {
      const oldInv = await this.inventoryModel.findById(oldInvId).exec();
      if (oldInv) {
        oldInv.currentCount = Math.max(0, oldInv.currentCount - 1);
        oldInv.totalGrossWeight = parseFloat(
          Math.max(0, oldInv.totalGrossWeight - item.grossWeight).toFixed(3),
        );
        oldInv.totalNetWeight = parseFloat(
          Math.max(0, oldInv.totalNetWeight - item.netWeight).toFixed(3),
        );
        oldInv.tagDetails = this.updateTagDetailsList(
          oldInv.tagDetails,
          item.tagWeight,
          -1,
        );
        await oldInv.save();
      }

      const newInv = await this.inventoryModel.findById(newInvId).exec();
      if (newInv) {
        newInv.currentCount += 1;
        newInv.totalGrossWeight = parseFloat(
          (newInv.totalGrossWeight + grossWeight).toFixed(3),
        );
        newInv.totalNetWeight = parseFloat(
          (newInv.totalNetWeight + netWeight).toFixed(3),
        );
        newInv.tagDetails = this.updateTagDetailsList(
          newInv.tagDetails,
          tagWeight,
          1,
        );
        await newInv.save();
      }
    } else if (newInvId) {
      const weightDiffGross = parseFloat(
        (grossWeight - item.grossWeight).toFixed(3),
      );
      const weightDiffNet = parseFloat((netWeight - item.netWeight).toFixed(3));

      const invItem = await this.inventoryModel.findById(newInvId).exec();
      if (invItem) {
        invItem.totalGrossWeight = parseFloat(
          (invItem.totalGrossWeight + weightDiffGross).toFixed(3),
        );
        invItem.totalNetWeight = parseFloat(
          (invItem.totalNetWeight + weightDiffNet).toFixed(3),
        );

        if (item.tagWeight !== tagWeight) {
          invItem.tagDetails = this.updateTagDetailsList(
            invItem.tagDetails,
            item.tagWeight,
            -1,
          );
          invItem.tagDetails = this.updateTagDetailsList(
            invItem.tagDetails,
            tagWeight,
            1,
          );
        }

        await invItem.save();
      }
    }

    const updatedItem = await this.barcodeInventoryModel
      .findByIdAndUpdate(
        item._id,
        {
          ...updateDto,
          grossWeight,
          tagWeight,
          netWeight,
          imageUrl: updatedImageUrl,
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
      throw new NotFoundException('فشل تعديل القطعة');
    }

    return updatedItem;
  }

  // 5. الحذف الناعم
  async softDelete(id: string, userId: string): Promise<void> {
    const item = await this.barcodeInventoryModel
      .findOne({ _id: id, isArchived: false })
      .exec();

    if (!item) {
      throw new NotFoundException('القطعة غير موجودة أو مؤرشفة');
    }

    if (item.status === 'SOLD') {
      throw new BadRequestException('لا يمكن أرشفة قطعة تم بيعها!');
    }

    await this.barcodeInventoryModel
      .updateOne({ _id: id }, { isArchived: true })
      .exec();

    if (item.inventoryRef) {
      const invItem = await this.inventoryModel
        .findById(item.inventoryRef)
        .exec();
      if (invItem) {
        invItem.currentCount = Math.max(0, invItem.currentCount - 1);
        invItem.totalGrossWeight = parseFloat(
          Math.max(0, invItem.totalGrossWeight - item.grossWeight).toFixed(3),
        );
        invItem.totalNetWeight = parseFloat(
          Math.max(0, invItem.totalNetWeight - item.netWeight).toFixed(3),
        );

        if (item.tagWeight > 0) {
          invItem.tagDetails = this.updateTagDetailsList(
            invItem.tagDetails,
            item.tagWeight,
            -1,
          );
        }

        await invItem.save();
      }
    }

    await this.movementsService.logMovement({
      inventoryItem: (item.inventoryRef || item._id).toString(),
      type: 'SALE_OUT',
      countChange: -1,
      grossWeightChange: -item.grossWeight,
      netWeightChange: -item.netWeight,
      actionBy: userId,
      reason: `أرشفة/حذف قطعة الباركود [${item.barcode}]`,
    });
  }

  // 6. جلب القطع المؤرشفة
  async findAllArchived(): Promise<BarcodeInventory[]> {
    return this.barcodeInventoryModel
      .find({ isArchived: true })
      .populate('category', 'name')
      .sort({ updatedAt: -1 })
      .exec();
  }

  // 7. توليد صورة الباركود Base64
  async generateBarcodeImage(
    barcode: string,
  ): Promise<{ barcode: string; imageBase64: string }> {
    const item = await this.findByBarcode(barcode);

    try {
      const pngBuffer = await bwipjs.toBuffer({
        bcid: 'code128',
        text: item.barcode,
        scale: 3,
        height: 10,
        includetext: true,
        textxalign: 'center',
      });

      return {
        barcode: item.barcode,
        imageBase64: `data:image/png;base64,${pngBuffer.toString('base64')}`,
      };
    } catch (error) {
      throw new BadRequestException('فشل في توليد صورة الباركود');
    }
  }

  // 8. تغيير الحالة لـ SOLD عند البيع
  async markAsSold(barcode: string, session?: any): Promise<BarcodeInventory> {
    const item = await this.barcodeInventoryModel
      .findOne({ barcode: barcode.trim(), isArchived: false })
      .session(session || null)
      .exec();

    if (!item) {
      throw new NotFoundException(
        `القطعة ذات الباركود (${barcode}) غير موجودة`,
      );
    }

    if (item.status === 'SOLD') {
      throw new BadRequestException(
        `القطعة ذات الباركود (${barcode}) مباعة بالفعل!`,
      );
    }

    item.status = 'SOLD';
    await item.save({ session });

    if (item.inventoryRef) {
      const invItem = await this.inventoryModel
        .findById(item.inventoryRef)
        .session(session || null)
        .exec();

      if (invItem) {
        invItem.currentCount = Math.max(0, invItem.currentCount - 1);
        invItem.totalGrossWeight = parseFloat(
          Math.max(0, invItem.totalGrossWeight - item.grossWeight).toFixed(3),
        );
        invItem.totalNetWeight = parseFloat(
          Math.max(0, invItem.totalNetWeight - item.netWeight).toFixed(3),
        );

        if (item.tagWeight > 0) {
          invItem.tagDetails = this.updateTagDetailsList(
            invItem.tagDetails,
            item.tagWeight,
            -1,
          );
        }

        await invItem.save({ session });
      }
    }

    return item;
  }
}
