import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum BullionPurchaseStatus {
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Schema({ _id: false })
export class BullionPurchaseItem {
  @Prop({ type: Types.ObjectId, ref: 'BullionInventory', required: true })
  bullionItem: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  karat: number; // 24 أو 21

  @Prop({ required: true })
  weightPerUnit: number; // وزن القطعة بالجرام

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ required: true })
  buyGoldPricePerGram: number; // سعر جرام الشراء لحظة العملية

  @Prop({ default: 0 })
  cashbackPerUnit: number; // قيمة الكاش باك المسترجعة للعميل عن القطعة الواحدة

  @Prop({ required: true })
  itemTotalGoldPrice: number; // (weight * quantity) * buyGoldPricePerGram

  @Prop({ default: 0 })
  itemTotalCashback: number; // cashbackPerUnit * quantity

  @Prop({ required: true })
  itemGrandTotal: number; // itemTotalGoldPrice + itemTotalCashback
}

export const BullionPurchaseItemSchema =
  SchemaFactory.createForClass(BullionPurchaseItem);

@Schema({ timestamps: true })
export class BullionPurchase extends Document {
  @Prop({ required: true, unique: true })
  invoiceNumber: string; // مثال: BP-1001

  @Prop({ type: Types.ObjectId, ref: 'Customer', required: true })
  customer: Types.ObjectId;

  @Prop({ type: [BullionPurchaseItemSchema], required: true })
  items: BullionPurchaseItem[];

  @Prop({ required: true })
  totalGoldWeight: number; // إجمالي جرامات الذهب المشتراة

  @Prop({ required: true, default: 0 })
  totalCashbackPaid: number; // إجمالي الكاش باك المدفوع للعميل

  @Prop({ required: true })
  grandTotal: number; // الإجمالي النهائي المدفوع للعميل

  @Prop({
    type: String,
    enum: BullionPurchaseStatus,
    default: BullionPurchaseStatus.COMPLETED,
  })
  status: BullionPurchaseStatus;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  buyer: Types.ObjectId; // الموظف/المالك الذي قام بعملية الشراء

  @Prop()
  notes?: string;
}

export const BullionPurchaseSchema =
  SchemaFactory.createForClass(BullionPurchase);
