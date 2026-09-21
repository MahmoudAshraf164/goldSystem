import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SilverItemDocument = SilverItem & Document;

export enum SilverKarat {
  K600 = 600,
  K800 = 800,
  K900 = 900,
  K925 = 925,
  K1000 = 1000,
}

export enum SilverCategory {
  RING = 'خاتم',
  WEDDING_BAND = 'دبلة',
  BRACELET = 'أنسيل',
  CHAIN = 'سلسلة',
  EARRING = 'حلق',
  OTHER = 'أخرى',
}

@Schema({ timestamps: true })
export class SilverItem {
  @Prop({ required: true })
  title: string; // مثل: سلسلة إيطالي عيار 925

  @Prop({ required: true, enum: [600, 800, 900, 925, 1000] })
  karat: number;

  @Prop({ required: true, enum: Object.values(SilverCategory) })
  category: string;

  @Prop({ required: true, min: 0 })
  weight: number; // الوزن بالجرام

  @Prop({ default: 1 })
  quantity: number; // الكمية (للقطع المكررة أو 1 للقطع الفريدة)

  @Prop({ default: 'AVAILABLE', enum: ['AVAILABLE', 'SOLD', 'ARCHIVED'] })
  status: string;

  @Prop()
  notes?: string;
}

export const SilverItemSchema = SchemaFactory.createForClass(SilverItem);