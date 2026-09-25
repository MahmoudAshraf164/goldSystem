import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SilverSafeConfigDocument = SilverSafeConfig & Document;

@Schema({ timestamps: true })
export class SilverSafeConfig {
  @Prop({ required: true })
  passwordHash: string; // أو يمكن التخزين كـ string متطابق
}

export const SilverSafeConfigSchema = SchemaFactory.createForClass(SilverSafeConfig);