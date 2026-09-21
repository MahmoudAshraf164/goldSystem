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
  weight: number; // الوزن المباع

  @Prop({ required: true })
  pricePerGram: number; // سعر جرام الفضة عند البيع

  @Prop({ required: true })
  totalPrice: number; // إجمالي مبلغ البيع النقدي

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  soldBy: Types.ObjectId; // البائع

  @Prop()
  notes?: string;
}

export const SilverSaleSchema = SchemaFactory.createForClass(SilverSale);