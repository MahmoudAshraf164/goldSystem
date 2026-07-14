import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class VerifyOtpDto {
  @IsEmail()
  @IsNotEmpty()
  @ApiProperty({ example: 'owner@gold.com' })
  email: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^[0-9]{6}$/, { message: 'رمز التحقق يجب أن يتكون من 6 أرقام فقط' })
  @ApiProperty({ example: '123456' })
  otp: string;
}
