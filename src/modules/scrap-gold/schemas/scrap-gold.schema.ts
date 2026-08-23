import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class ScrapGold extends Document {
  @Prop({
    type: Number,
    required: true,
    enum: [18, 21, 24], // 👈 إضافة عيار 24 لدعم الذهب المسبوك النقي
    unique: true,
    index: true,
  })
  karat: number;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  totalWeight: number;
}

export const ScrapGoldSchema = SchemaFactory.createForClass(ScrapGold);
