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
      | 'BULLION_IN'
      | 'BULLION_SALE_OUT'
      | 'BULLION_CANCEL_RETURN'
      | 'BULLION_UPDATE_RETURN'; // 👈 تم إضافة أنواع السبايك والجنيهات هنا
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

  // جلب سجل التحركات للمالك مع تفنيط ديناميكي للجديد والكسر والسبايك
  async getMovements(inventoryItemId?: string): Promise<StockMovement[]> {
    const filter: any = {};
    if (inventoryItemId) {
      filter.inventoryItem = new Types.ObjectId(inventoryItemId);
    }

    const movements = await this.movementModel
      .find(filter)
      .populate('actionBy', 'fullName role')
      .sort({ createdAt: -1 })
      .exec();

    const populatedMovements = await Promise.all(
      movements.map(async (movement) => {
        const movementObj: any = movement.toObject();

        // أ- البحث في كولكشن الذهب الجديد
        const newGoldItem = await this.movementModel.db
          .model('Inventory')
          .findById(movementObj.inventoryItem)
          .select('title karat')
          .exec();

        if (newGoldItem) {
          movementObj.inventoryItem = newGoldItem;
        } else {
          // ب- البحث في كولكشن السبايك والجنيهات
          const bullionItem = await this.movementModel.db
            .model('BullionInventory')
            .findById(movementObj.inventoryItem)
            .select('title karat companyName')
            .exec();

          if (bullionItem) {
            movementObj.inventoryItem = {
              _id: bullionItem._id,
              title: `${bullionItem.title} - ${bullionItem.companyName}`,
              karat: bullionItem.karat,
            };
          } else {
            // ج- البحث في كولكشن الذهب الكسر
            const scrapGoldItem = await this.movementModel.db
              .model('ScrapGold')
              .findById(movementObj.inventoryItem)
              .select('karat')
              .exec();

            if (scrapGoldItem) {
              movementObj.inventoryItem = {
                _id: scrapGoldItem._id,
                title: `ذهب كسر عيار ${scrapGoldItem.karat}`,
                karat: scrapGoldItem.karat,
              };
            } else {
              // د- حماية إضافية للقيم المحذوفة أو المعدلة
              movementObj.inventoryItem = {
                _id: movementObj.inventoryItem,
                title: 'صنف من فاتورة معدلة / صنف قديم',
                karat: null,
              };
            }
          }
        }

        return movementObj;
      }),
    );

    return populatedMovements as any;
  }
}
