import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SilverSafeTransactionDocument = SilverSafeTransaction & Document;

export enum SilverTransactionType {
  SALE_INCOME = 'بيع_فضة',
  SCRAP_PURCHASE_EXPENSE = 'شراء_كسر_فضة',
  MANUAL_DEPOSIT = 'إيداع_يدوي',
  MANUAL_WITHDRAWAL = 'سحب_يدوي',
  RESET = 'تصفير_الخزنة',
  ADJUSTMENT = 'تعديل_رصيد',
}

@Schema({ timestamps: true })
export class SilverSafeTransaction {
  @Prop({ required: true, enum: Object.values(SilverTransactionType) })
  type: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ default: 0 })
  weightChange: number;

  @Prop({ enum: [600, 800, 900, 925, 1000] })
  karat?: number;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop()
  notes?: string;
}

export const SilverSafeTransactionSchema = SchemaFactory.createForClass(SilverSafeTransaction);