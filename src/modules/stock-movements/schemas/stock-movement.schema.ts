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
      'BULLION_IN', // 👈 تم إضافة نوع إدخال السبايك الجديد هنا
      'BULLION_UPDATE_RETURN', // 👈 تم إضافة نوع تعديل السبايك الجديد هنا
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
