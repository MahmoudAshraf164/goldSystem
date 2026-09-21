import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SilverSaleDocument = SilverSale & Document;

@Schema({ timestamps: true })
export class SilverSale {
  @Prop({ type: Types.ObjectId, ref: 'SilverItem', required: true })
  silverItem: Types.ObjectId;

  @Prop({ required: true, enum: [600, 800, 900, 925, 1000] })
  karat: number;

  @Prop({ required: true })
  weight: number;

  @Prop({ required: true })
  pricePerGram: number;

  @Prop({ required: true })
  totalPrice: number;

  // بيانات العميل المضافة
  @Prop()
  customerName?: string;

  @Prop()
  customerPhone?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  soldBy: Types.ObjectId;

  @Prop()
  notes?: string;
}

export const SilverSaleSchema = SchemaFactory.createForClass(SilverSale);