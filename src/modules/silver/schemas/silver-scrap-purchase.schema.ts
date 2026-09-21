import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SilverScrapPurchaseDocument = SilverScrapPurchase & Document;

@Schema({ timestamps: true })
export class SilverScrapPurchase {
  @Prop({ required: true, enum: [600, 800, 900, 925, 1000] })
  karat: number;

  @Prop({ required: true })
  weight: number; // الوزن المشترى من الزبون

  @Prop({ required: true })
  pricePerGram: number; // سعر الجرام للكسر

  @Prop({ required: true })
  totalPaid: number; // المبلغ المدفوع للزبون من خزنة الفضة

  @Prop()
  customerName?: string;

  @Prop()
  customerPhone?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  purchasedBy: Types.ObjectId;

  @Prop()
  notes?: string;
}

export const SilverScrapPurchaseSchema = SchemaFactory.createForClass(SilverScrapPurchase);