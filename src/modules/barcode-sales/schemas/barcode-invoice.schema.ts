import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BarcodeInvoiceDocument = BarcodeInvoice & Document;

@Schema({ timestamps: true })
export class BarcodeInvoiceItem {
  @Prop({ type: Types.ObjectId, ref: 'BarcodeInventory', required: true })
  item: Types.ObjectId;

  @Prop({ required: true })
  barcode: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true, enum: [18, 21, 24] })
  karat: number;

  @Prop({ required: true })
  netWeight: number;

  @Prop({ required: true })
  goldPricePerGram: number; // سعر جرام الذهب وقت البيع

  @Prop({ required: true })
  goldTotalPrice: number; // سعر الذهب الصافي = الوزن الصافي × سعر الجرام

  @Prop({ required: true, default: 0 })
  makingChargePerGram: number; // مصنعية الجرام

  @Prop({ required: true, default: 0 })
  totalMakingCharge: number; // إجمالي المصنعية للقطعة

  @Prop({ required: true })
  finalPrice: number; // إجمالي سعر القطعة = الذهب + المصنعية
}

export const BarcodeInvoiceItemSchema =
  SchemaFactory.createForClass(BarcodeInvoiceItem);

@Schema({ timestamps: true })
export class BarcodeInvoice {
  @Prop({ required: true, unique: true, index: true })
  invoiceNumber: string; // رقم الفاتورة مثل: INV-2026-0001

  @Prop({ type: [BarcodeInvoiceItemSchema], required: true })
  items: BarcodeInvoiceItem[];

  @Prop({ required: true, default: 0 })
  totalNetWeight: number; // إجمالي الوزن الصافي المباع

  @Prop({ required: true, default: 0 })
  totalAmount: number; // إجمالي المبلغ المطلوب

  @Prop({ required: true, default: 0 })
  discount: number; // خصم إضافي على الفاتورة

  @Prop({ required: true, default: 0 })
  finalPaidAmount: number; // الصافي النهائي بعد الخصم

  @Prop({ type: Types.ObjectId, ref: 'Customer', required: false })
  customer: Types.ObjectId; // العميل (اختياري)

  @Prop({ default: 'CASH' })
  paymentMethod: string; // طريقة الدفع (كاش / شبكة / تحويل)

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId; // الموظف البائع

  @Prop({ default: false })
  isCancelled: boolean; // هل الفاتورة ملغاة
}

export const BarcodeInvoiceSchema =
  SchemaFactory.createForClass(BarcodeInvoice);
