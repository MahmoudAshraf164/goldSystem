import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ScrapGold } from './schemas/scrap-gold.schema';
import { BuyScrapDto } from './dto/buy-scrap.dto';
import { StockMovementsService } from '../stock-movements/stock-movements.service';

@Injectable()
export class ScrapGoldService {
  constructor(
    @InjectModel(ScrapGold.name) public readonly scrapModel: Model<ScrapGold>,
    private readonly movementsService: StockMovementsService,
  ) {}

  // 1. جلب رصيد أوزان الكسر لكل عيار
  async getInventory(): Promise<ScrapGold[]> {
    const counts = await this.scrapModel.countDocuments();
    if (counts === 0) {
      await this.scrapModel.insertMany([
        { karat: 18, totalWeight: 0 },
        { karat: 21, totalWeight: 0 },
      ]);
    }
    return this.scrapModel.find().exec();
  }

  // 2. شراء / إضافة وزن كسر (تراكمي آمن)
  async buyScrap(buyScrapDto: BuyScrapDto, userId: string): Promise<ScrapGold> {
    const { karat, weight } = buyScrapDto;
    const roundedWeight = Number(weight.toFixed(3));

    const updated = await this.scrapModel
      .findOneAndUpdate(
        { karat },
        { $inc: { totalWeight: roundedWeight } },
        { new: true, upsert: true },
      )
      .exec();

    // تسجيل حركة مخزنية
    await this.movementsService.logMovement({
      inventoryItem: updated._id.toString(),
      type: 'INVENTORY_IN',
      countChange: 0,
      grossWeightChange: weight,
      netWeightChange: weight,
      actionBy: userId,
      reason: `إضافة/شراء ذهب كسر عيار ${karat} بوزن ${weight} جرام`,
    });

    return updated;
  }
}
