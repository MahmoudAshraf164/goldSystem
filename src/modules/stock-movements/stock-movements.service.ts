import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { StockMovement } from './schemas/stock-movement.schema';

@Injectable()
export class StockMovementsService {
  constructor(
    @InjectModel(StockMovement.name)
    private readonly movementModel: Model<StockMovement>,
  ) {}

  // دالة داخلية الباكيند بيستدعيها لتسجيل الحركة فوراً
  async logMovement(data: {
    inventoryItem: string | Types.ObjectId;
    type:
      | 'INVENTORY_IN'
      | 'SALE_OUT'
      | 'INVOICE_UPDATE_RETURN'
      | 'INVOICE_UPDATE_OUT'
      | 'BULLION_IN' // 👈 تم إضافته للـ TypeScript Type
      | 'BULLION_UPDATE_RETURN'; // 👈 تم إضافته للـ TypeScript Type
    countChange: number;
    grossWeightChange: number;
    netWeightChange: number;
    actionBy: string;
    reason?: string;
  }): Promise<StockMovement> {
    const newLog = new this.movementModel({
      inventoryItem: new Types.ObjectId(data.inventoryItem),
      type: data.type,
      countChange: data.countChange,
      grossWeightChange: parseFloat(data.grossWeightChange.toFixed(3)),
      netWeightChange: parseFloat(data.netWeightChange.toFixed(3)),
      actionBy: new Types.ObjectId(data.actionBy),
      reason: data.reason,
    });
    return newLog.save();
  }

  // جلب سجل التحركات للمالك لمراقبة الجرد
  // جلب سجل التحركات للمالك مع تفنيط ديناميكي للجديد والكسر
  async getMovements(inventoryItemId?: string): Promise<StockMovement[]> {
    const filter: any = {};
    if (inventoryItemId) {
      filter.inventoryItem = new Types.ObjectId(inventoryItemId);
    }

    // 1. جلب الحركات الأساسية من الداتا بيز مع عمل populate للمسؤول عن الحركة
    const movements = await this.movementModel
      .find(filter)
      .populate('actionBy', 'fullName role')
      .sort({ createdAt: -1 }) // من الأحدث للأقدم دائماً
      .exec();

    // 2. عمل جلب ديناميكي لبيانات القطعة/الخزنة في الـ Memory لمنع الـ null والخطأ البرمجي
    const populatedMovements = await Promise.all(
      movements.map(async (movement) => {
        // تحويل المستند لـ Object عادي مع تعيين النوع كـ any لمنع خطأ الـ TypeScript الظاهر في الصورة
        const movementObj: any = movement.toObject();

        // أ- محاولة البحث أولاً في كولكشن الذهب الجديد (Inventory)
        const newGoldItem = await this.movementModel.db
          .model('Inventory')
          .findById(movementObj.inventoryItem)
          .select('title karat')
          .exec();

        if (newGoldItem) {
          // لو لقاها بضاعة جديدة، يربط الـ Object الخاص بها مباشرة
          movementObj.inventoryItem = newGoldItem;
        } else {
          // ب- لو ملهاش وجود في الجديد، يبقى ذهب كسر، نروح ندور في كولكشن الـ ScrapGold بقيمة الـ ID
          const scrapGoldItem = await this.movementModel.db
            .model('ScrapGold')
            .findById(movementObj.inventoryItem)
            .select('karat')
            .exec();

          if (scrapGoldItem) {
            // صياغة Object متوافق مع نفس هيكل الفرونت إند بدون أي اعتراض من الـ Compiler
            movementObj.inventoryItem = {
              _id: scrapGoldItem._id,
              title: `ذهب كسر عيار ${scrapGoldItem.karat}`,
              karat: scrapGoldItem.karat,
            };
          } else {
            // ج- حماية إضافية في حال كان الصنف ممسوح نهائياً من السيستم أو من حركات قديمة
            movementObj.inventoryItem = {
              _id: movementObj.inventoryItem,
              title: 'صنف من فاتورة معدلة / كسر قديم',
              karat: null,
            };
          }
        }

        return movementObj;
      }),
    );

    return populatedMovements as any;
  }
}
