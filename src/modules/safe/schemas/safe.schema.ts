import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Safe extends Document {
  @Prop({ type: Number, required: true, default: 0 })
  balance: number; // الرصيد الحالي الصافي بالخزنة

  @Prop({ type: String, required: false, default: null })
  safePassword: string; // باسورد الخزنة المشفر الخاص بالعمليات الحساسة

  @Prop({
    type: {
      actionType: {
        type: String,
        enum: [
          'INFLOW',
          'OUTFLOW',
          'MANUAL_ADJUSTMENT',
          'RESET',
          'BULLION_SALE', // 👈 إدراج نوع بيع السبايك
          'BULLION_SALE_EDIT', // 👈 إدراج نوع تعديل فاتورة السبايك
          'BULLION_SALE_CANCEL', // 👈 إدراج نوع إلغاء فاتورة السبايك
        ],
      },
      amount: { type: Number },
      reason: { type: String },
      timestamp: { type: Date, default: Date.now },
      actionBy: { type: Types.ObjectId, ref: 'User' },
    },
    required: false,
  })
  lastUpdatedAction: {
    actionType: string;
    amount: number;
    reason: string;
    timestamp: Date;
    actionBy: Types.ObjectId;
  };
}

export const SafeSchema = SchemaFactory.createForClass(Safe);
