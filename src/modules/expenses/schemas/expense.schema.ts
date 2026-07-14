import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Expense extends Document {
  @Prop({ type: String, required: true })
  title: string; // "شراء مقشة للمحل" أو "شراء ذهب كسر من زبون" أو "بضاعة جديدة جملة"

  @Prop({ type: Number, required: true, min: 0 })
  amount: number; // الفلوس اللي خرجت فورا

  @Prop({
    type: String,
    required: true,
    enum: ['GOLD_PURCHASE', 'SHOP_EXPENSES', 'SALARIES', 'OTHERS'],
    default: 'OTHERS',
  })
  category: string; // GOLD_PURCHASE (شراء ذهب) | SHOP_EXPENSES (تكاليف محل ومقشة)

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  actionBy: Types.ObjectId;
}

export const ExpenseSchema = SchemaFactory.createForClass(Expense);
