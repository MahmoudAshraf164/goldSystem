import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum BullionType {
  INGOT = 'INGOT', // سبيكة
  COIN = 'COIN', // جنيه / نصف / ربع
}

@Schema({ timestamps: true })
export class BullionInventory extends Document {
  @Prop({ type: String, required: true })
  title: string; // مثال: "سبيكة 5 جرام BTC" أو "جنيه ذهب BTC"

  @Prop({ type: String, enum: BullionType, required: true, index: true })
  type: BullionType;

  @Prop({ type: String, required: true, index: true })
  companyName: string; // BTC, Master Gold, SAM, Selim ...الخ

  @Prop({ type: Number, required: true })
  karat: number; // 24 للسبايك أو 21 للجنيهات

  @Prop({ type: Number, required: true })
  weightPerUnit: number; // وزن القطعة الواحدة بالجرام (مثال: 5 لسبيكة 5ج، أو 8 للجنيه)

  @Prop({ type: Number, required: true, default: 0 })
  quantity: number; // عدد القطع المتوفرة حالياً بالخزينة/المخزن

  @Prop({ type: Number, required: true, default: 0 })
  makingChargePerUnit: number; // مصنعية القطعة الواحدة البيعية

  @Prop({ type: Number, required: true, default: 0 })
  cashbackPerUnit: number; // قيمة الكاش باك المسترد للقطعة (في حالة الشراء/الإرجاع بغلافها)

  @Prop({ type: Boolean, default: false })
  isArchived: boolean;
}

export const BullionInventorySchema =
  SchemaFactory.createForClass(BullionInventory);
