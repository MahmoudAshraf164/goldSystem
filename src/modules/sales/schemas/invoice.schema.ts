import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema()
export class InvoiceItem {
  @Prop({ type: Types.ObjectId, ref: 'Inventory', required: true })
  inventoryItem: Types.ObjectId;

  @Prop({ type: Number, required: true })
  soldGrossWeight: number; // الوزن المدخل بالورقة

  @Prop({ type: Number, required: true })
  soldNetWeight: number; // الصافي الفعلي بعد الحسبة

  @Prop({ type: Boolean, required: true, default: true })
  hasTag: boolean;

  @Prop({ type: Number, required: true })
  goldPriceToday: number; // سعر الجرام وقت البيع

  @Prop({ type: Number, required: true })
  makingChargesPerGram: number; // مصنعية الجرام وقت البيع

  @Prop({ type: Number, required: true })
  itemTotalPrice: number; // إجمالي سعر هذه القطعة بشكل منفصل
}

@Schema({ timestamps: true })
export class Invoice extends Document {
  @Prop({ type: String, required: true, unique: true, index: true })
  invoiceNumber: string;

  @Prop({ type: Types.ObjectId, ref: 'Customer', required: true, index: true })
  customer: Types.ObjectId;

  @Prop({ type: [InvoiceItem], required: true })
  items: InvoiceItem[];

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  soldBy: Types.ObjectId;

  @Prop({ type: Number, required: true })
  totalInvoiceGrossWeight: number;

  @Prop({ type: Number, required: true })
  totalInvoiceNetWeight: number;

  @Prop({ type: Number, required: true })
  totalPrice: number; // مجموع أسعار كل القطع تلقائياً

  @Prop({
    type: String,
    enum: ['COMPLETED', 'CANCELLED'],
    default: 'COMPLETED',
    index: true,
  })
  status: string;
}

export const InvoiceSchema = SchemaFactory.createForClass(Invoice);
