import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class ScrapInvoice extends Document {
  @Prop({ type: String, required: true, unique: true, index: true })
  invoiceNumber: string;

  @Prop({ type: Types.ObjectId, ref: 'Customer', required: true, index: true })
  customer: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Category', required: true })
  category: Types.ObjectId;

  @Prop({ type: Number, required: true, enum: [18, 21], index: true })
  karat: number;

  @Prop({ type: Number, required: true, min: 1 })
  count: number;

  @Prop({ type: Number, required: true, min: 0.001 })
  weight: number;

  @Prop({ type: Number, required: true })
  goldPriceToday: number;

  @Prop({ type: Number, required: true })
  makingChargesPerGram: number;

  @Prop({ type: Number, required: true, min: 0 })
  totalPrice: number;

  @Prop({
    type: String,
    enum: ['COMPLETED', 'CANCELLED'],
    default: 'COMPLETED',
    index: true,
  })
  status: string; // 👈 ضفنا حقل الحالة لإدارة الإلغاء والمرتجع الكلي

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  actionBy: Types.ObjectId;
}

export const ScrapInvoiceSchema = SchemaFactory.createForClass(ScrapInvoice);
