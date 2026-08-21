import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BarcodeInventoryDocument = BarcodeInventory & Document;

@Schema({ timestamps: true })
export class BarcodeInventory {
  @Prop({ required: true, unique: true, index: true })
  barcode: string; // رمز الباركود الفريد للقطعة مثل JWL-21-0001

  @Prop({ required: true })
  title: string; // اسم القطعة (مثلاً: خاتم لازوردي سوليتير)

  @Prop({ required: true, enum: [18, 21, 24] })
  karat: number; // العيار (18 / 21 / 24)

  @Prop({ required: true })
  grossWeight: number; // الوزن القائم بالجرام (مثال: 4.25)

  @Prop({ required: true, default: 0.06 })
  tagWeight: number; // وزن تيكت/جراب المصنع البلاستيك (مثال: 0.06)

  @Prop({ required: true })
  netWeight: number; // الوزن الصافي = القائم - وزن التيكت

  @Prop({ required: true, default: 0 })
  makingChargePerGram: number; // مصنعية الجرام الواحد

  @Prop({
    required: true,
    enum: ['AVAILABLE', 'SOLD', 'RESERVED'],
    default: 'AVAILABLE',
  })
  status: string; // حالة القطعة (متاحة / مباعة / محجوزة)

  @Prop({ type: Types.ObjectId, ref: 'Category', required: false })
  category: Types.ObjectId; // التصنيف (خواتم / سلاسل / غوايش...)

  @Prop({ default: '-' })
  companyName: string; // اسم المورد أو الشركة (مثلاً: لازوردي / إيجيبت جولد)

  @Prop({ default: false })
  isArchived: boolean;
}

export const BarcodeInventorySchema =
  SchemaFactory.createForClass(BarcodeInventory);
