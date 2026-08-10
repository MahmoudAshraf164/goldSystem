import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Inventory } from './schemas/inventory.schema';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { AddStockDto } from './dto/add-stock.dto';
import { StockMovementsService } from '../stock-movements/stock-movements.service';

@Injectable()
export class InventoryService {
  constructor(
    @InjectModel(Inventory.name)
    public readonly inventoryModel: Model<Inventory>,
    private readonly movementsService: StockMovementsService,
  ) {}

  // 1. إضافة مخزون جديد
  async create(
    createInventoryDto: CreateInventoryDto,
    userId: string,
  ): Promise<Inventory> {
    const { initialCount, totalGrossWeight, title, companyName, tagDetails } =
      createInventoryDto;

    let totalTagsWeight = 0;
    let totalTagsCount = 0;

    if (tagDetails && tagDetails.length > 0) {
      for (const tag of tagDetails) {
        totalTagsWeight += tag.count * tag.weight;
        totalTagsCount += tag.count;
      }
    }

    if (totalTagsCount > initialCount) {
      throw new BadRequestException(
        'إجمالي عدد القطع المحددة بالتيكت يتخطى العدد الكلي للبضاعة!',
      );
    }

    const totalNetWeight = parseFloat(
      (totalGrossWeight - totalTagsWeight).toFixed(3),
    );
    if (totalNetWeight <= 0) {
      throw new BadRequestException(
        'الوزن الصافي الناتج أقل من أو يساوي صفر! يرجى مراجعة أوزان التيكت.',
      );
    }

    const newInventory = new this.inventoryModel({
      ...createInventoryDto,
      companyName: companyName && companyName.trim() !== '' ? companyName : '-',
      currentCount: initialCount,
      initialGrossWeight: totalGrossWeight,
      totalNetWeight,
      tagDetails: tagDetails || [],
    });

    const savedItem = await newInventory.save();

    await this.movementsService.logMovement({
      inventoryItem: savedItem._id.toString(),
      type: 'INVENTORY_IN',
      countChange: savedItem.initialCount,
      grossWeightChange: savedItem.totalGrossWeight,
      netWeightChange: savedItem.totalNetWeight,
      actionBy: userId,
      reason: `إدخال بضاعة لشركة (${savedItem.companyName}) باسم: ${title} - عيار ${savedItem.karat} - وزن ابتدائي قائم: ${totalGrossWeight}ج`,
    });

    return savedItem;
  }

  // 2. تزويد كمية/بضاعة إضافية على عنصر موجود (Restock)
  async addStock(
    id: string,
    addStockDto: AddStockDto,
    userId: string,
  ): Promise<Inventory> {
    const { count, grossWeight, tagDetails } = addStockDto;

    const item = await this.inventoryModel
      .findOne({ _id: id, isArchived: false })
      .exec();

    if (!item) {
      throw new NotFoundException('البضاعة المطلوبة غير موجودة أو مؤرشفة');
    }

    let addedTagsWeight = 0;
    let addedTagsCount = 0;

    if (tagDetails && tagDetails.length > 0) {
      for (const tag of tagDetails) {
        addedTagsWeight += tag.count * tag.weight;
        addedTagsCount += tag.count;
      }
    }

    if (addedTagsCount > count) {
      throw new BadRequestException(
        'عدد القطع المحددة بالتيكت للدفعة الجديدة يتخطى العدد المضاف!',
      );
    }

    const addedNetWeight = parseFloat(
      (grossWeight - addedTagsWeight).toFixed(3),
    );

    if (addedNetWeight <= 0) {
      throw new BadRequestException(
        'الوزن الصافي للدفعة المضافة أقل من أو يساوي صفر! مراجعة أوزان التيكت.',
      );
    }

    const updatedTagDetails = [...item.tagDetails];
    if (tagDetails && tagDetails.length > 0) {
      for (const newTag of tagDetails) {
        const existingTagIndex = updatedTagDetails.findIndex(
          (t) => t.weight === newTag.weight,
        );
        if (existingTagIndex > -1) {
          updatedTagDetails[existingTagIndex].count += newTag.count;
        } else {
          updatedTagDetails.push(newTag);
        }
      }
    }

    const newInitialCount = item.initialCount + count;
    const newCurrentCount = item.currentCount + count;
    const newInitialGrossWeight = parseFloat(
      (item.initialGrossWeight + grossWeight).toFixed(3),
    );
    const newTotalGrossWeight = parseFloat(
      (item.totalGrossWeight + grossWeight).toFixed(3),
    );
    const newTotalNetWeight = parseFloat(
      (item.totalNetWeight + addedNetWeight).toFixed(3),
    );

    item.initialCount = newInitialCount;
    item.currentCount = newCurrentCount;
    item.initialGrossWeight = newInitialGrossWeight;
    item.totalGrossWeight = newTotalGrossWeight;
    item.totalNetWeight = newTotalNetWeight;
    item.tagDetails = updatedTagDetails;

    const savedItem = await item.save();

    await this.movementsService.logMovement({
      inventoryItem: savedItem._id.toString(),
      type: 'INVENTORY_IN',
      countChange: count,
      grossWeightChange: grossWeight,
      netWeightChange: addedNetWeight,
      actionBy: userId,
      reason: `إضافة كمية إضافية (+${count} قطعة) لـ (${savedItem.title}) - عيار ${savedItem.karat} - وزن قائم مضاف: ${grossWeight}ج`,
    });

    return savedItem;
  }

  // 3. تحديث المخزن وإعادة الموازنة
  async update(
    id: string,
    updateInventoryDto: any,
    userId: string,
  ): Promise<Inventory> {
    const oldItem = await this.inventoryModel
      .findOne({ _id: id, isArchived: false })
      .exec();
    if (!oldItem)
      throw new NotFoundException('مجموعة الذهب المطلوبة غير موجودة أو مؤرشفة');

    const targetInitialCount =
      updateInventoryDto.initialCount !== undefined
        ? updateInventoryDto.initialCount
        : oldItem.initialCount;
    const targetGrossWeight =
      updateInventoryDto.totalGrossWeight !== undefined
        ? updateInventoryDto.totalGrossWeight
        : oldItem.totalGrossWeight;
    const targetTagDetails =
      updateInventoryDto.tagDetails !== undefined
        ? updateInventoryDto.tagDetails
        : oldItem.tagDetails;

    let totalTagsWeight = 0;
    if (targetTagDetails && targetTagDetails.length > 0) {
      for (const tag of targetTagDetails) {
        totalTagsWeight += tag.count * tag.weight;
      }
    }

    const countDifference = targetInitialCount - oldItem.initialCount;
    const grossWeightDifference = parseFloat(
      (targetGrossWeight - oldItem.totalGrossWeight).toFixed(3),
    );

    const targetNetWeight = parseFloat(
      (targetGrossWeight - totalTagsWeight).toFixed(3),
    );
    if (targetNetWeight <= 0)
      throw new BadRequestException('الوزن الصافي المحدث أقل من أو يساوي صفر!');

    const netWeightDifference = parseFloat(
      (targetNetWeight - oldItem.totalNetWeight).toFixed(3),
    );
    const newCurrentCount = oldItem.currentCount + countDifference;

    if (newCurrentCount < 0)
      throw new BadRequestException(
        'لا يمكن تقليل العدد ليكون أقل من القطع المباعة بالفعل!',
      );

    const updatedItem = await this.inventoryModel
      .findByIdAndUpdate(
        id,
        {
          ...updateInventoryDto,
          currentCount: newCurrentCount,
          totalNetWeight: targetNetWeight,
        },
        { new: true },
      )
      .populate('category', 'name')
      .exec();

    if (!updatedItem) {
      throw new NotFoundException('مجموعة الذهب المطلوبة غير موجودة أو مؤرشفة');
    }

    if (countDifference !== 0 || grossWeightDifference !== 0) {
      await this.movementsService.logMovement({
        inventoryItem: id,
        type: 'INVENTORY_IN',
        countChange: countDifference,
        grossWeightChange: grossWeightDifference,
        netWeightChange: netWeightDifference,
        actionBy: userId,
        reason: `تعديل الجرد للمالك لـ (${updatedItem.title}) - عيار ${updatedItem.karat}`,
      });
    }

    return updatedItem;
  }

  // 4. جلب المخزون
  async findAll(
    status: string = 'ACTIVE',
    karat?: number,
    companyName?: string,
  ): Promise<Inventory[]> {
    const isArchivedQuery = status.toUpperCase() === 'ARCHIVED';
    const filter: any = { isArchived: isArchivedQuery };

    if (karat) filter.karat = karat;
    if (companyName) {
      if (companyName === '-') {
        filter.companyName = '-';
      } else {
        filter.companyName = { $regex: companyName, $options: 'i' };
      }
    }

    return this.inventoryModel
      .find(filter)
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .exec();
  }

  // 5. جلب بالتفاصيل
  async findById(id: string): Promise<Inventory> {
    const item = await this.inventoryModel
      .findOne({ _id: id, isArchived: false })
      .populate('category', 'name')
      .exec();
    if (!item)
      throw new NotFoundException('مجموعة الذهب هذه غير موجودة في المخزن');
    return item;
  }

  // 6. أرشفة
  async softDelete(id: string): Promise<void> {
    const result = await this.inventoryModel
      .updateOne({ _id: id, isArchived: false }, { isArchived: true })
      .exec();
    if (result.matchedCount === 0)
      throw new NotFoundException('المستند غير موجود أو محذوف');
  }
}
