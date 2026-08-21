import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  Min,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBarcodeItemDto {
  @ApiPropertyOptional({
    description:
      'رمز الباركود الفريد للقطعة، وفي حال عدم إرساله يقوم النظام بتوليده تلقائياً',
    example: '20261001001',
  })
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiProperty({
    description: 'اسم/عنوان القطعة الذهبية',
    example: 'خاتم سوليتير عيار 21',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'عيار الذهب (18، 21، أو 24)',
    enum: [18, 21, 24],
    example: 21,
  })
  @IsNumber()
  @IsEnum([18, 21, 24])
  karat: number;

  @ApiProperty({
    description: 'الوزن القائم (الإجمالي) بالجرام شامل التاج أو الفصوص',
    example: 5.45,
  })
  @IsNumber()
  @Min(0.001)
  grossWeight: number;

  @ApiPropertyOptional({
    description: 'وزن التاج / الكارت / الخيط المخصوم بالجرام (إن وجد)',
    example: 0.12,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tagWeight?: number;

  @ApiProperty({
    description: 'مصنعية الجرام الواحد للقطعة بالعملة المحلية',
    example: 150.0,
  })
  @IsNumber()
  @Min(0)
  makingChargePerGram: number;

  @ApiPropertyOptional({
    description: 'معرف التصنيف / الفئة التابعة لها القطعة',
    example: '60d5ecb8b5c9c22b4c8b4567',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'اسم الشركة أو المورد / المصنع للقطعة',
    example: 'لازوردي',
  })
  @IsOptional()
  @IsString()
  companyName?: string;
}
