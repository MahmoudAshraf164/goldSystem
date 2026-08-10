import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  Min,
} from 'class-validator';

export class UpdateSafeBalanceDto {
  @ApiProperty({
    example: 50000,
    description: 'الرصيد الجديد المراد تعيينه في الخزنة',
  })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  newBalance: number;

  @ApiProperty({
    example: '1234',
    description: 'باسورد الخزنة الخاص بالعمليات الحساسة',
  })
  @IsString()
  @IsNotEmpty()
  safePassword: string;

  @ApiProperty({
    example: 'تعديل يدوي لوجود فروقات جرد',
    description: 'سبب التعديل اليدوي',
  })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class ResetSafeDto {
  @ApiProperty({
    example: '1234',
    description: 'باسورد الخزنة الحالي لتأكيد التصفير',
  })
  @IsString()
  @IsNotEmpty()
  safePassword: string;
}

export class SetupSafePasswordDto {
  @ApiProperty({
    example: '1234',
    description: 'الباسورد الحالي (يترك فارغاً لو كانت أول مرة)',
  })
  @IsString()
  @IsOptional()
  currentSafePassword?: string;

  @ApiProperty({
    example: '5678',
    description: 'الباسورد الجديد المشفر للخزنة',
  })
  @IsString()
  @IsNotEmpty()
  newSafePassword: string;
}
