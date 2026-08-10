import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema()
export class InvoiceItem {
  @Prop({ type: Types.ObjectId, ref: 'Inventory', required: true })
  inventoryItem: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 1, default: 1 })
  soldCount: number; // 👈 حفظ عدد القطع المباعة في الفاتورة للرجوع إليها مستقبلاً

  @Prop({ type: Number, required: true })
  soldGrossWeight: number; // الوزن الإجمالي الكلي المدخل للمجموعه

  @Prop({ type: Number, required: true })
  soldNetWeight: number; // الصافي الفعلي للمجموعه بعد خصم التيكتات المتعددة

  @Prop({ type: Boolean, required: true, default: true })
  hasTag: boolean;

  @Prop({ type: Number, required: true })
  goldPriceToday: number;

  @Prop({ type: Number, required: true })
  makingChargesPerGram: number;

  @Prop({ type: Number, required: true })
  itemTotalPrice: number; // إجمالي سعر القطع المجمعة معاً
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
  totalPrice: number;

  @Prop({
    type: String,
    enum: ['COMPLETED', 'CANCELLED'],
    default: 'COMPLETED',
    index: true,
  })
  status: string;
}

export const InvoiceSchema = SchemaFactory.createForClass(Invoice);
