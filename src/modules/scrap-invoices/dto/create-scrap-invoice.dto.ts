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
    description: 'ID العميل أو الزبون المشتري',
  })
  @IsMongoId()
  @IsNotEmpty()
  customer: string;

  @ApiProperty({
    example: '6a35d0ed889402772415d53c',
    description: 'ID التصنيف (خواتم، غوايش...)',
  })
  @IsMongoId()
  @IsNotEmpty()
  category: string;

  @ApiProperty({ example: 21, enum: [18, 21] })
  @IsNumber()
  @IsIn([18, 21], { message: 'العيار يجب أن يكون 18 أو 21' })
  karat: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'عدد القطع الكسر المبيوعة (اختياري)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  count?: number;

  @ApiProperty({
    example: 5.5,
    description: 'الوزن الصافي بالجرام',
  })
  @IsNumber()
  @Min(0.001)
  weight: number;

  @ApiProperty({ example: 3850, description: 'سعر جرام الذهب الكسر اليوم' })
  @IsNumber()
  @Min(0)
  goldPriceToday: number;

  @ApiProperty({ example: 50, description: 'سعر المصنعية لجرام الكسر' })
  @IsNumber()
  @Min(0)
  makingChargesPerGram: number;
}
