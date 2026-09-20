import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class ScrapPurchase extends Document {
  @Prop({ type: String, required: true, unique: true })
  purchaseNumber: string; // رقم عملية الشراء الموحد مثل: SCRAP-1001

  @Prop({ type: String, required: true })
  customerName: string; // اسم الزبون

  @Prop({ type: String, default: null })
  customerPhone: string; // رقم هاتف الزبون (اختياري)

  @Prop({ type: Number, required: true, enum: [18, 21] })
  karat: number; // عيار 18 أو 21

  @Prop({ type: Number, required: true, min: 0.001 })
  weight: number; // الوزن بالجرام

  @Prop({ type: Number, required: true, min: 0 })
  totalPrice: number; // المبلغ النقدي المدفوع من الخزنة

  @Prop({ type: String, default: '' })
  notes: string; // ملاحظات أو بيان قطعة الكسر

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  actionBy: Types.ObjectId; // الموظف/المالك الذي أجرى عملية الشراء
}

export const ScrapPurchaseSchema = SchemaFactory.createForClass(ScrapPurchase);