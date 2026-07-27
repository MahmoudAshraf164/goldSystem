import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema()
export class ScrapCategoryItem {
  @Prop({ type: Types.ObjectId, ref: 'Category', required: true })
  category: Types.ObjectId;

  @Prop({ type: Number, required: false, default: 0, min: 0 })
  count: number; // اختياري

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  weight: number; // الوزن الإجباري والأساسي
}

@Schema({ timestamps: true })
export class ScrapGold extends Document {
  @Prop({
    type: Number,
    required: true,
    enum: [18, 21],
    unique: true,
    index: true,
  })
  karat: number;

  @Prop({ type: [ScrapCategoryItem], default: [] })
  items: ScrapCategoryItem[];
}

export const ScrapGoldSchema = SchemaFactory.createForClass(ScrapGold);
