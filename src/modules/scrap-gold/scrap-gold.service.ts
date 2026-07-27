import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ScrapGold } from './schemas/scrap-gold.schema';
import { Category } from '../categories/schemas/category.schema';
import { BuyScrapDto } from './dto/buy-scrap.dto';
import { StockMovementsService } from '../stock-movements/stock-movements.service';

@Injectable()
export class ScrapGoldService {
  constructor(
    @InjectModel(ScrapGold.name) public readonly scrapModel: Model<ScrapGold>,
    @InjectModel(Category.name) private readonly categoryModel: Model<Category>,
    private readonly movementsService: StockMovementsService,
  ) {}

  // 1. جلب رصيد الكسر بالتفصيل
  async getInventory(): Promise<ScrapGold[]> {
    const counts = await this.scrapModel.countDocuments();
    if (counts === 0) {
      await this.scrapModel.insertMany([
        { karat: 18, items: [] },
        { karat: 21, items: [] },
      ]);
    }
    return this.scrapModel.find().populate('items.category', 'name').exec();
  }

  // 2. شراء / إضافة كسر (تراكمي على نفس الـ Item الموجود)
  async buyScrap(buyScrapDto: BuyScrapDto, userId: string): Promise<ScrapGold> {
    const { karat, category, count = 0, weight } = buyScrapDto;

    const existingCategory = await this.categoryModel
      .findOne({ _id: category, isArchived: false })
      .exec();
    if (!existingCategory) {
      throw new NotFoundException('عذراً، التصنيف المحدد غير موجود في السيستم');
    }

    const categoryObjectId = new Types.ObjectId(category);
    let scrapRecord = await this.scrapModel.findOne({ karat }).exec();
    if (!scrapRecord) {
      scrapRecord = new this.scrapModel({ karat, items: [] });
    }

    const itemIndex = scrapRecord.items.findIndex(
      (item) => item.category.toString() === category,
    );

    // إذا كان التصنيف موجود مسبقاً، ندمج عليه الأوزان والأعداد تلقائياً
    if (itemIndex > -1) {
      scrapRecord.items[itemIndex].count += count;
      scrapRecord.items[itemIndex].weight = parseFloat(
        (scrapRecord.items[itemIndex].weight + weight).toFixed(3),
      );
    } else {
      scrapRecord.items.push({
        category: categoryObjectId,
        count,
        weight: parseFloat(weight.toFixed(3)),
      } as any);
    }

    const updated = await scrapRecord.save();

    // تسجيل حركة مخزنية
    await this.movementsService.logMovement({
      inventoryItem: updated._id.toString(),
      type: 'INVENTORY_IN',
      countChange: count,
      grossWeightChange: weight,
      netWeightChange: weight,
      actionBy: userId,
      reason: `إضافة/شراء ذهب كسر عيار ${karat} - تصنيف: ${existingCategory.name}`,
    });

    return updated.populate('items.category', 'name');
  }
}
