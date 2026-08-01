import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class StockMovement extends Document {
  @Prop({ type: Types.ObjectId, required: true, index: true }) // 👈 تم إزالة ref: 'Inventory' الصارم لمنع الـ null مع الكسر
  inventoryItem: Types.ObjectId;
  @Prop({
    type: String,
    enum: [
      'INVENTORY_IN',
      'SALE_OUT',
      'INVOICE_UPDATE_RETURN',
      'INVOICE_UPDATE_OUT',
      'BULLION_IN',
      'BULLION_SALE_OUT',
      'BULLION_CANCEL_RETURN',
      'BULLION_UPDATE_RETURN',
    ],
    required: true,
  })
  type: string; // نوع الحركة (إدخال مخزن، بيع، إرجاع بسبب تعديل، خصم بسبب تعديل)

  @Prop({ type: Number, required: true })
  countChange: number; // التغير في العدد (مثال: +25 أو -1)

  @Prop({ type: Number, required: true })
  grossWeightChange: number; // التغير في الوزن الإجمالي (بالسالب أو الموجب)

  @Prop({ type: Number, required: true })
  netWeightChange: number; // التغير في الوزن الصافي (بالسالب أو الموجب)

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  actionBy: Types.ObjectId; // مين الموظف أو المالك اللي عمل الحركة دي

  @Prop({ type: String, required: false })
  reason?: string; // سبب اختياري (مثل: رقم الفاتورة أو "مخزون ابتدائي")
}

export const StockMovementSchema = SchemaFactory.createForClass(StockMovement);
