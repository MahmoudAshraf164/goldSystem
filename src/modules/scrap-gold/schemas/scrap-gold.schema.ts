import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class ScrapGold extends Document {
  @Prop({
    type: Number,
    required: true,
    enum: [18, 21],
    unique: true,
    index: true,
  })
  karat: number; // العيار (18 أو 21)

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  totalWeight: number; // 👈 الوزن الإجمالي التراكمي لذهب الكسر بهذا العيار بالجرام
}

export const ScrapGoldSchema = SchemaFactory.createForClass(ScrapGold);
