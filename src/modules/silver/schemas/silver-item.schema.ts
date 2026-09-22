import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SilverItemDocument = SilverItem & Document;

export enum SilverKarat {
  K600 = 600,
  K800 = 800,
  K900 = 900,
  K925 = 925,
  K1000 = 1000,
}

@Schema({ timestamps: true })
export class SilverItem {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true, enum: [600, 800, 900, 925, 1000] })
  karat: number;

  @Prop({ type: Types.ObjectId, ref: 'Category', required: true })
  category: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  weight: number;

  @Prop({ default: 1 })
  quantity: number;

  @Prop({ default: 'AVAILABLE', enum: ['AVAILABLE', 'SOLD', 'ARCHIVED'] })
  status: string;

  @Prop()
  notes?: string;
}

export const SilverItemSchema = SchemaFactory.createForClass(SilverItem);