import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MeltingLog, MeltingLogDocument } from './schemas/melting-log.schema';
import { ScrapGoldService } from '../scrap-gold/scrap-gold.service';
import { CreateMeltingDto } from './dto/create-melting.dto';

@Injectable()
export class MeltingService {
  constructor(
    @InjectModel(MeltingLog.name)
    private readonly meltingLogModel: Model<MeltingLogDocument>,
    private readonly scrapGoldService: ScrapGoldService, // 👈 استخدام الخدمة بدلاً من الموديل المباشر
  ) {}

  async processMelting(dto: CreateMeltingDto, userId: string) {
    const { karat, rawWeightBeforeMelting, netWeightAfterMelting, notes } = dto;

    if (netWeightAfterMelting > rawWeightBeforeMelting) {
      throw new BadRequestException(
        'لا يمكن أن يكون الوزن بعد التسييح أكبر من الوزن قبل التسييح!',
      );
    }

    // 1. حساب وزن الهالك والنسبة
    const lossWeight = parseFloat(
      (rawWeightBeforeMelting - netWeightAfterMelting).toFixed(3),
    );
    const lossPercentage = parseFloat(
      ((lossWeight / rawWeightBeforeMelting) * 100).toFixed(2),
    );

    // 2. خصم الوزن الخام قبل التسييح من المخزون
    await this.scrapGoldService.deductScrap(
      karat,
      rawWeightBeforeMelting,
      userId,
      `تسييح ذهب كسر عيار ${karat} (وزن قبل التسييح ${rawWeightBeforeMelting} جرام)`,
    );

    // 3. إضافة الوزن الصافي المسبوك الناتج إلى المخزون
    await this.scrapGoldService.buyScrap(
      {
        karat,
        weight: netWeightAfterMelting,
      },
      userId,
    );

    // 4. حفظ العملية وسجل الهالك في MeltingLog
    const meltingLog = new this.meltingLogModel({
      karat,
      rawWeightBeforeMelting,
      netWeightAfterMelting,
      lossWeight,
      lossPercentage,
      notes,
      actionBy: userId,
    });

    await meltingLog.save();

    return {
      message: 'تمت عملية التسييح وخصم الخام وإضافة المسبوك وحساب الهالك بنجاح',
      data: {
        karat,
        rawWeightBeforeMelting,
        netWeightAfterMelting,
        lossWeight,
        lossPercentage: `${lossPercentage}%`,
        logId: meltingLog._id,
      },
    };
  }

  // تقرير سجلات التسييح والهالك
  async getMeltingHistory() {
    return this.meltingLogModel.find().sort({ createdAt: -1 }).exec();
  }
}
