import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Category extends Document {
  @Prop({ type: String, required: true, unique: true, trim: true })
  name: string;

  @Prop({ type: Boolean, default: false })
  isArchived: boolean; // الحذف الناعم (Soft Delete)
}

export const CategorySchema = SchemaFactory.createForClass(Category);
