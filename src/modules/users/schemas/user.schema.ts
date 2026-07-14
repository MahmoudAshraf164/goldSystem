import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Role } from '../../../common/enums/role.enum';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ type: String, required: true, trim: true })
  fullName: string;

  @Prop({
    type: String,
    required: true,
    unique: true,
    index: true,
    lowercase: true,
    trim: true,
  })
  email: string;

  @Prop({ type: String, required: true })
  passwordHash: string;

  @Prop({ type: String, required: true, trim: true })
  phoneNumber: string;

  @Prop({ type: String, enum: Role, required: true })
  role: Role;

  @Prop({
    type: String,
    enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED'],
    default: 'ACTIVE',
  })
  status: string;

  // ─── حقول خاصة بالموظف فقط (Optional للمالك) ───
  @Prop({ type: String, required: false, trim: true })
  nationalId?: string;

  @Prop({ type: String, required: false, trim: true })
  address?: string;

  // ─── حقول التحقق المؤقتة (للـ OTP الخاص بالمالك) ───
  @Prop({ type: String, required: false })
  currentOtp?: string;

  @Prop({ type: String, required: false })
  resetPasswordToken?: string;

  @Prop({ type: Date, required: false })
  resetPasswordExpires?: Date;

  @Prop({ type: Date, required: false })
  otpExpiresAt?: Date;

  @Prop({ type: Number, default: 0 })
  otpAttempts: number;
}

export const UserSchema = SchemaFactory.createForClass(User);
