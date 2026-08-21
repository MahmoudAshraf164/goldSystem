import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class StockMovement extends Document {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  inventoryItem: Types.ObjectId;

  @Prop({
    type: String,
    enum: [
      'INVENTORY_IN',
      'SALE_OUT',
      'INVOICE_CANCEL_RETURN', // 👈 إضافة نوع إرجاع الباركود عند إلغاء الفاتورة
      'INVOICE_UPDATE_RETURN', // 👈 إرجاع قطعة للمخزن عند تعديل الفاتورة
      'INVOICE_UPDATE_OUT', // 👈 خروج قطعة جديدة عند تعديل الفاتورة
      'BULLION_IN',
      'BULLION_SALE_OUT',
      'BULLION_UPDATE_RETURN',
      'BULLION_UPDATE_OUT',
      'BULLION_CANCEL_RETURN',
    ],
    required: true,
  })
  type: string;

  @Prop({ type: Number, required: true })
  countChange: number;

  @Prop({ type: Number, required: true })
  grossWeightChange: number;

  @Prop({ type: Number, required: true })
  netWeightChange: number;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  actionBy: Types.ObjectId;

  @Prop({ type: String, required: false })
  reason?: string;
}

export const StockMovementSchema = SchemaFactory.createForClass(StockMovement);
