import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BarcodeInventoryDocument = BarcodeInventory & Document;

@Schema({ timestamps: true })
export class BarcodeInventory {
  @Prop({ required: true, unique: true, index: true })
  barcode: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true, enum: [18, 21, 24] })
  karat: number;

  @Prop({ required: true })
  grossWeight: number;

  @Prop({ required: true, default: 0.06 })
  tagWeight: number;

  @Prop({ required: true })
  netWeight: number;

  @Prop({ required: true, default: 0 })
  makingChargePerGram: number;

  @Prop({
    required: true,
    enum: ['AVAILABLE', 'SOLD', 'RESERVED'],
    default: 'AVAILABLE',
  })
  status: string;

  @Prop({ type: Types.ObjectId, ref: 'Category', required: false })
  category?: Types.ObjectId;

  // 👈 ربط قطعة الباركود بالمخزون العام
  @Prop({
    type: Types.ObjectId,
    ref: 'Inventory',
    required: false,
    index: true,
  })
  inventoryRef?: Types.ObjectId;

  @Prop({ default: '-' })
  companyName: string;

  @Prop({ default: false })
  isArchived: boolean;
}

export const BarcodeInventorySchema =
  SchemaFactory.createForClass(BarcodeInventory);
