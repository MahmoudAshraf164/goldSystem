import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema()
export class TagDetail {
  @Prop({ type: Number, required: true, min: 0 })
  count: number;

  @Prop({ type: Number, required: true, min: 0 })
  weight: number;
}

@Schema({ timestamps: true })
export class Inventory extends Document {
  @Prop({ type: String, required: true, trim: true })
  title: string;

  @Prop({
    type: String,
    required: false,
    trim: true,
    default: '-',
    index: true,
  })
  companyName: string;

  @Prop({ type: Types.ObjectId, ref: 'Category', required: true, index: true })
  category: Types.ObjectId;

  // 🛠️ تحديث الـ enum ليشمل عيار 24
  @Prop({ type: Number, required: true, enum: [18, 21, 24], index: true })
  karat: number;

  @Prop({ type: Number, required: true, min: 1 })
  initialCount: number;

  @Prop({ type: Number, required: true, min: 0 })
  currentCount: number;

  @Prop({ type: Number, required: true, min: 0 })
  initialGrossWeight: number;

  @Prop({ type: Number, required: true, min: 0 })
  totalGrossWeight: number;

  @Prop({ type: Number, required: true, min: 0 })
  totalNetWeight: number;

  @Prop({ type: [TagDetail], default: [] })
  tagDetails: TagDetail[];

  @Prop({ type: Boolean, default: false, index: true })
  isArchived: boolean;
}

export const InventorySchema = SchemaFactory.createForClass(Inventory);
