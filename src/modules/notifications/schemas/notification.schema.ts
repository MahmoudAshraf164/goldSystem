import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Notification extends Document {
  @Prop({ type: String, required: true })
  message: string; // نص الإشعار التفصيلي

  @Prop({
    type: String,
    required: true,
    enum: ['NEW_GOLD_SALE', 'SCRAP_GOLD_SALE'],
    default: 'NEW_GOLD_SALE',
  })
  type: string; // نوع الحركة
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
