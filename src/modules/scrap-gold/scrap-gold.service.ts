import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ScrapGold } from './schemas/scrap-gold.schema';
import { BuyScrapDto } from './dto/buy-scrap.dto';
import { UpdateScrapDto } from './dto/update-scrap.dto';
import { StockMovementsService } from '../stock-movements/stock-movements.service';

@Injectable()
export class ScrapGoldService {
  constructor(
    @InjectModel(ScrapGold.name) public readonly scrapModel: Model<ScrapGold>,
    private readonly movementsService: StockMovementsService,
  ) {}

  // 1. جلب رصيد أوزان الكسر وضمان تهيئة العيارات الثلاثة (18، 21، 24)
  async getInventory(): Promise<ScrapGold[]> {
    const requiredKarats = [18, 21, 24];
    const existingRecords = await this.scrapModel.find().exec();
    const existingKarats = new Set(existingRecords.map((r) => r.karat));

    const missingKarats = requiredKarats
      .filter((k) => !existingKarats.has(k))
      .map((karat) => ({ karat, totalWeight: 0 }));

    if (missingKarats.length > 0) {
      await this.scrapModel.insertMany(missingKarats);
    }

    return this.scrapModel.find().sort({ karat: 1 }).exec();
  }

  // 2. شراء / إضافة وزن كسر (تراكمي)
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

    await this.movementsService.logMovement({
      inventoryItem: updated._id.toString(),
      type: 'INVENTORY_IN' as any,
      countChange: 0,
      grossWeightChange: roundedWeight,
      netWeightChange: roundedWeight,
      actionBy: userId,
      reason: `إضافة/شراء ذهب كسر عيار ${karat} بوزن ${roundedWeight} جرام`,
    });

    return updated;
  }

  // 3. خصم وزن كسر للمخزن (تُستخدم عند التسييح أو المبيعات)
  async deductScrap(
    karat: number,
    weight: number,
    userId: string,
    reason?: string,
  ): Promise<ScrapGold> {
    const roundedWeight = Number(weight.toFixed(3));

    const currentDoc = await this.scrapModel.findOne({ karat }).exec();
    if (!currentDoc || currentDoc.totalWeight < roundedWeight) {
      throw new BadRequestException(
        `رصيد الكسر المتاح لعيار ${karat} غير كافي. المتاح: ${
          currentDoc ? currentDoc.totalWeight : 0
        } جرام`,
      );
    }

    const updated = await this.scrapModel
      .findOneAndUpdate(
        { karat },
        { $inc: { totalWeight: -roundedWeight } },
        { new: true },
      )
      .exec();

    if (!updated) {
      throw new BadRequestException(`فشلت عملية تحديث السجل لعيار ${karat}`);
    }

    await this.movementsService.logMovement({
      inventoryItem: updated._id.toString(),
      type: 'INVENTORY_OUT' as any,
      countChange: 0,
      grossWeightChange: -roundedWeight,
      netWeightChange: -roundedWeight,
      actionBy: userId,
      reason: reason || `خصم ذهب كسر عيار ${karat} بوزن ${roundedWeight} جرام`,
    });

    return updated;
  }

  // 4. تعديل رصيد كسر المخزن مباشرة (تسوية جرد)
  async updateScrapBalance(
    updateScrapDto: UpdateScrapDto,
    userId: string,
  ): Promise<ScrapGold> {
    const { karat, newWeight } = updateScrapDto;
    const roundedWeight = Number(newWeight.toFixed(3));

    const currentDoc = await this.scrapModel.findOne({ karat }).exec();
    const oldWeight = currentDoc ? currentDoc.totalWeight : 0;
    const difference = Number((roundedWeight - oldWeight).toFixed(3));

    const updated = await this.scrapModel
      .findOneAndUpdate(
        { karat },
        { totalWeight: roundedWeight },
        { new: true, upsert: true },
      )
      .exec();

    await this.movementsService.logMovement({
      inventoryItem: updated._id.toString(),
      type: 'INVENTORY_IN' as any,
      countChange: 0,
      grossWeightChange: difference,
      netWeightChange: difference,
      actionBy: userId,
      reason: `تعديل/تسوية جرد كسر عيار ${karat} من (${oldWeight}ج) إلى (${roundedWeight}ج)`,
    });

    return updated;
  }
}
