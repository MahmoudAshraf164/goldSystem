import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Supplier extends Document {
  @Prop({ required: true, trim: true })
  name: string; // اسم المورد أو الورشة

  @Prop({ required: true })
  phone: string; // رقم التليفون

  @Prop()
  address: string; // العنوان

  // رصيد الحساب المفتوح (الموجب يعني المورد ليه عندنا، السالب يعني علينا ليه)
  @Prop({ type: Number, default: 0 })
  cashBalance: number; // رصيد الفلوس (المصري)

  @Prop({
    type: {
      karat24: { type: Number, default: 0 },
      karat21: { type: Number, default: 0 },
      karat18: { type: Number, default: 0 },
    },
    default: { karat24: 0, karat21: 0, karat18: 0 },
  })
  goldBalances: {
    karat24: number;
    karat18: number;
    karat21: number;
  }; // أرصدة الذهب لكل عيار بالجرام
}

export const SupplierSchema = SchemaFactory.createForClass(Supplier);
