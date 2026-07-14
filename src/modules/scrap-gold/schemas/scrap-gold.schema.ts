import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema()
export class ScrapCategoryItem {
  @Prop({ type: Types.ObjectId, ref: 'Category', required: true })
  category: Types.ObjectId; // الربط مع موديول التصنيفات (خواتم، غوايش، سلاسل...)

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  count: number; // عدد القطع من النوع ده بالظبط في الكسر

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  weight: number; // وزن القطع من النوع ده بالجرام
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
  karat: number; // العيار (18 أو 21)

  @Prop({ type: [ScrapCategoryItem], default: [] })
  items: ScrapCategoryItem[]; // 👈 المصفوفة التفصيلية لكل نوع ذهب مستعمل جوه العيار
}

export const ScrapGoldSchema = SchemaFactory.createForClass(ScrapGold);
