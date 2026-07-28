import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  Min,
  IsIn,
  IsOptional,
} from 'class-validator';

export class CreateScrapInvoiceDto {
  @ApiProperty({
    example: '6a369213e4ea5a76417d2353',
    description: 'ID العميل المشتري',
  })
  @IsMongoId()
  @IsNotEmpty()
  customer: string;

  @ApiProperty({ example: 21, enum: [18, 21] })
  @IsNumber()
  @IsIn([18, 21], { message: 'العيار يجب أن يكون 18 أو 21' })
  karat: number;

  @ApiProperty({
    example: 5.5,
    description: 'الوزن المباع بالجرام',
  })
  @IsNumber()
  @Min(0.001, { message: 'الوزن يجب أن يكون أكبر من صفر' })
  weight: number;

  @ApiProperty({ example: 3850, description: 'سعر جرام الذهب الكسر اليوم' })
  @IsNumber()
  @Min(0)
  goldPriceToday: number;

  @ApiProperty({ example: 50, description: 'سعر المصنعية لجرام الكسر' })
  @IsNumber()
  @Min(0)
  makingChargesPerGram: number;

  @ApiPropertyOptional({
    example: 50000,
    description:
      'الإجمالي النهائي بعد الفصال (اختياري - إذا أُرسل سيُعاد حساب المصنعية تلقائياً)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalPrice?: number; // 👈 تم إضافته كحقل اختياري
}
