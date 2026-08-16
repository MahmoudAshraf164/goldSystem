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
      'INVOICE_UPDATE_RETURN',
      'INVOICE_UPDATE_OUT',
      'BULLION_IN',
      'BULLION_SALE_OUT', // 👈 إضافة نوع خروج مبيعات السبايك
      'BULLION_UPDATE_RETURN',
      'BULLION_UPDATE_OUT', // 👈 إضافة نوع زيادة كمية السبايك بالتعديل
      'BULLION_CANCEL_RETURN', // 👈 إضافة نوع إرجاع السبايك عند الإلغاء
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
