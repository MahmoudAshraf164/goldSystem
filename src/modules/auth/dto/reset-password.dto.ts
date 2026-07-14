import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'owner@gold.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^[0-9]{6}$/, { message: 'رمز التحقق يجب أن يتكون من 6 أرقام' })
  otp: string;

  @ApiProperty({ example: 'NewStrongPassword123!', minLength: 6 })
  @IsString()
  @IsNotEmpty()
  @Length(6, 50)
  newPassword: string;
}
