import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema()
export class TagDetail {
  @Prop({ type: Number, required: true, min: 0 })
  count: number; // عدد القطع بهذا الوزن (مثال: 5)

  @Prop({ type: Number, required: true, min: 0 })
  weight: number; // وزن التيكت الواحد (مثال: 0.04)
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
  companyName: string; // اختياري، القيمة الافتراضية للفلترة هي '-'

  @Prop({ type: Types.ObjectId, ref: 'Category', required: true, index: true })
  category: Types.ObjectId;

  @Prop({ type: Number, required: true, enum: [18, 21], index: true })
  karat: number;

  @Prop({ type: Number, required: true, min: 1 })
  initialCount: number;

  @Prop({ type: Number, required: true, min: 0 })
  currentCount: number;

  @Prop({ type: Number, required: true, min: 0 })
  initialGrossWeight: number; // 🛠️ تثبيت الوزن الابتدائي عند أول إدخال لمراجعته دائماً

  @Prop({ type: Number, required: true, min: 0 })
  totalGrossWeight: number; // الوزن القائم الحالي (يقل مع المبيعات)

  @Prop({ type: Number, required: true, min: 0 })
  totalNetWeight: number; // الوزن الصافي الحالي

  @Prop({ type: [TagDetail], default: [] })
  tagDetails: TagDetail[]; // 🛠️ المصفوفة المرنة لتعدد أوزان التيكت في الشحنة الواحدة

  @Prop({ type: Boolean, default: false, index: true })
  isArchived: boolean;
}

export const InventorySchema = SchemaFactory.createForClass(Inventory);
