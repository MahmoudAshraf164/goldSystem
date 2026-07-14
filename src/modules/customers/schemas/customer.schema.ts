import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Customer extends Document {
  @Prop({ type: String, required: true, trim: true })
  fullName: string;

  @Prop({ type: String, required: true, unique: true, index: true, trim: true })
  phoneNumber: string; // رقم الهاتف فريد والبحث به سريع

  @Prop({ type: String, required: false, trim: true })
  nationalId?: string; // الرقم القومي (اختياري)

  @Prop({ type: String, required: false, trim: true }) // 👈 الحقل الساقط اللي كان مسبب المشكلة
  address?: string; // العنوان الخاص بالعميل

  @Prop({
    type: String,
    enum: ['ACTIVE', 'ARCHIVED'],
    default: 'ACTIVE',
    index: true,
  })
  status: string; // الحذف الناعم (الأرشيف)
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);
