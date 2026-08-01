import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  BullionInventory,
  BullionType,
} from './schemas/bullion-inventory.schema';
import { CreateBullionDto } from './dto/create-bullion.dto';
import { UpdateBullionDto } from './dto/update-bullion.dto';
import { StockMovementsService } from '../stock-movements/stock-movements.service';

@Injectable()
export class BullionInventoryService {
  constructor(
    @InjectModel(BullionInventory.name)
    private readonly bullionModel: Model<BullionInventory>,
    private readonly movementsService: StockMovementsService,
  ) {}

  // ─── 1. إضافة سبيكة / جنيه جديد للمخزن لأول مرة ───
  async createBullion(
    dto: CreateBullionDto,
    userId: string,
  ): Promise<BullionInventory> {
    const totalGrossWeight = parseFloat(
      (dto.quantity * dto.weightPerUnit).toFixed(3),
    );

    const newBullion = new this.bullionModel({
      ...dto,
      makingChargePerUnit: dto.makingChargePerUnit || 0,
      cashbackPerUnit: dto.cashbackPerUnit || 0,
    });

    const savedBullion = await newBullion.save();

    if (dto.quantity > 0) {
      await this.movementsService.logMovement({
        inventoryItem: savedBullion._id.toString(),
        type: 'BULLION_IN',
        countChange: dto.quantity,
        grossWeightChange: totalGrossWeight,
        netWeightChange: totalGrossWeight,
        actionBy: userId,
        reason: `إضافة مخزون ابتدائي للسبايك/الجنيهات: ${dto.title} (${dto.companyName})`,
      });
    }

    return savedBullion;
  }

  // ─── 2. إضافة كمية جديدة على نفس المنتج الموجود بالمخزن ───
  async addQuantityToBullion(
    id: string,
    addedQuantity: number,
    userId: string,
    reason?: string,
  ): Promise<BullionInventory> {
    if (addedQuantity <= 0) {
      throw new BadRequestException('الكمية المضافة يجب أن تكون أكبر من صفر');
    }

    const bullion = await this.bullionModel.findById(id).exec();
    if (!bullion || bullion.isArchived) {
      throw new NotFoundException('السبيكة/الجنيه غير موجود بالمخزن');
    }

    const addedWeight = parseFloat(
      (addedQuantity * bullion.weightPerUnit).toFixed(3),
    );

    // تحديث كمية المنتج
    bullion.quantity += addedQuantity;
    const updatedBullion = await bullion.save();

    // تسجيل حركة إدخال مخزني بالكمية المضافة والوزن الإجمالي
    await this.movementsService.logMovement({
      inventoryItem: bullion._id.toString(),
      type: 'BULLION_IN',
      countChange: addedQuantity,
      grossWeightChange: addedWeight,
      netWeightChange: addedWeight,
      actionBy: userId,
      reason: reason || `تزويد شحنة/كمية جديدة على المنتج: ${bullion.title}`,
    });

    return updatedBullion;
  }

  // ─── 3. تعديل بيانات السبيكة أو تعديل الكمية المباشر ───
  async updateBullion(
    id: string,
    dto: UpdateBullionDto,
    userId: string,
  ): Promise<BullionInventory> {
    const existingBullion = await this.bullionModel.findById(id).exec();
    if (!existingBullion) {
      throw new NotFoundException('القطعة غير موجودة في المخزن');
    }

    // إذا تغيرت الكمية من خلال وضع قيمة إجمالية جديدة
    if (
      dto.quantity !== undefined &&
      dto.quantity !== existingBullion.quantity
    ) {
      const countDiff = dto.quantity - existingBullion.quantity;
      const weightDiff = parseFloat(
        (countDiff * existingBullion.weightPerUnit).toFixed(3),
      );

      await this.movementsService.logMovement({
        inventoryItem: existingBullion._id.toString(),
        type: countDiff > 0 ? 'BULLION_IN' : 'BULLION_UPDATE_RETURN',
        countChange: countDiff,
        grossWeightChange: weightDiff,
        netWeightChange: weightDiff,
        actionBy: userId,
        reason: `تعديل يدوي للكمية في مخزن السبايك لـ: ${existingBullion.title}`,
      });
    }

    Object.assign(existingBullion, dto);
    return await existingBullion.save();
  }

  // ─── 4. جلب القوائم ───
  async findAllBullions(query?: {
    type?: BullionType;
    companyName?: string;
    isArchived?: boolean;
  }): Promise<BullionInventory[]> {
    const filter: any = {
      isArchived: query?.isArchived !== undefined ? query.isArchived : false,
    };

    if (query?.type) filter.type = query.type;
    if (query?.companyName)
      filter.companyName = { $regex: query.companyName, $options: 'i' };

    return this.bullionModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  async findOneBullion(id: string): Promise<BullionInventory> {
    const bullion = await this.bullionModel.findById(id).exec();
    if (!bullion || bullion.isArchived) {
      throw new NotFoundException('السبيكة/الجنيه غير موجود بالمخزن');
    }
    return bullion;
  }

  async archiveBullion(id: string): Promise<BullionInventory> {
    const bullion = await this.bullionModel.findById(id).exec();
    if (!bullion) throw new NotFoundException('القطعة غير موجودة');

    bullion.isArchived = true;
    return await bullion.save();
  }
}
