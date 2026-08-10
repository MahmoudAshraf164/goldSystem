import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Income extends Document {
  @Prop({ required: true, type: Number, min: 0 })
  amount: number;

  @Prop({ required: true, trim: true })
  reason: string; // سبب الدخل (مثلاً: سيولة إضافية للدرج، إرجاع سلفة، إلخ)

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  actionBy: Types.ObjectId; // الموظف أو المالك اللي قام بالإضافة
}

export const IncomeSchema = SchemaFactory.createForClass(Income);
