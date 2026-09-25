import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { StockMovement } from './schemas/stock-movement.schema';

export type MovementType =
  | 'INVENTORY_IN'
  | 'INVENTORY_OUT'
  | 'SALE_OUT'
  | 'SCRAP_IN'
  | 'SCRAP_OUT'
  | 'INVOICE_CANCEL_RETURN'
  | 'INVOICE_UPDATE_RETURN'
  | 'INVOICE_UPDATE_OUT'
  | 'BULLION_IN'
  | 'BULLION_SALE_OUT'
  | 'BULLION_UPDATE_RETURN'
  | 'BULLION_UPDATE_OUT'
  | 'BULLION_CANCEL_RETURN';

@Injectable()
export class StockMovementsService {
  constructor(
    @InjectModel(StockMovement.name)
    private readonly movementModel: Model<StockMovement>,
  ) {}

  // دالة تسجيل الحركة فوراً في الداتا بيز
  async logMovement(data: {
    inventoryItem: string | Types.ObjectId;
    type: MovementType;
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

 // في ملف stock-movements.service.ts

async getMovements(inventoryItemId?: string): Promise<StockMovement[]> {
  const filter: any = {};
  if (inventoryItemId) {
    filter.inventoryItem = new Types.ObjectId(inventoryItemId);
  }

  const movements = await this.movementModel
    .find(filter)
    .populate({
      path: 'actionBy',
      model: 'User', // التأكد من اسم Schema المستخدمين
      select: 'fullName name username role', // جلب كافة خيارات الاسم الممكنة
    })
    .sort({ createdAt: -1 })
    .exec();

  const populatedMovements = await Promise.all(
    movements.map(async (movement) => {
      const movementObj: any = movement.toObject();

      // معالجة حالة عدم وجود مستخدم مرتبط بالمعرف
      if (!movementObj.actionBy) {
        movementObj.actionBy = {
          fullName: 'النظام / تلقائي',
          role: 'SYSTEM',
        };
      }

      // 1. البحث في المخزون العام (Inventory)
      const newGoldItem = await this.movementModel.db
        .model('Inventory')
        .findById(movementObj.inventoryItem)
        .select('title karat')
        .exec();

      if (newGoldItem) {
        movementObj.inventoryItem = newGoldItem;
        return movementObj;
      }

      // 2. البحث في مخزون الباركود (BarcodeInventory)
      try {
        const barcodeItem = await this.movementModel.db
          .model('BarcodeInventory')
          .findById(movementObj.inventoryItem)
          .select('title karat barcode')
          .exec();

        if (barcodeItem) {
          movementObj.inventoryItem = {
            _id: barcodeItem._id,
            title: `[${barcodeItem.barcode}] ${barcodeItem.title}`,
            karat: barcodeItem.karat,
          };
          return movementObj;
        }
      } catch (e) {}

      // 3. البحث في الذهب الكسر (ScrapGold)
      try {
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
          return movementObj;
        }
      } catch (e) {}

      // 4. صنف احتياطي
      movementObj.inventoryItem = {
        _id: movementObj.inventoryItem,
        title: 'صنف من فاتورة تعديل / إرجاع قديم',
        karat: null,
      };

      return movementObj;
    }),
  );

  return populatedMovements as any;
}
}
