import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MeltingLogDocument = MeltingLog & Document;

@Schema({ timestamps: true })
export class MeltingLog {
  @Prop({ required: true })
  karat: number; // العيار (21, 18, 24, الخ)

  @Prop({ required: true })
  rawWeightBeforeMelting: number; // الوزن القائم الكسر قبل التسييح (مثل 2.60 جرام)

  @Prop({ required: true })
  netWeightAfterMelting: number; // الوزن الصافي الناتج بعد التسييح (مثل 2.50 جرام)

  @Prop({ required: true })
  lossWeight: number; // وزن الهالك/الخسة المفقود (مثل 0.10 جرام)

  @Prop({ required: true })
  lossPercentage: number; // نسبة الهالك (مثل 3.84%)

  @Prop()
  notes?: string; // ملاحظات (مثل: تسييح خواتم وسلاسل لحامات كثيرة)
}

export const MeltingLogSchema = SchemaFactory.createForClass(MeltingLog);
