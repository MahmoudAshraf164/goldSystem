import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Customer extends Document {
  @Prop({ type: String, required: true, trim: true })
  fullName: string;

  // 👈 فريد للأرقام الحقيقية فقط، وتجاهل المستندات التي لا تحتوي على رقم
  @Prop({
    type: String,
    required: false,
    unique: true,
    sparse: true,
    trim: true,
  })
  phoneNumber?: string;

  @Prop({ type: String, required: false, trim: true })
  nationalId?: string;

  @Prop({ type: String, required: false, trim: true })
  address?: string;

  @Prop({
    type: String,
    enum: ['ACTIVE', 'ARCHIVED'],
    default: 'ACTIVE',
    index: true,
  })
  status: string;
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);
