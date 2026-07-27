import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class BuyScrapDto {
  @ApiProperty({ example: 21, enum: [18, 21] })
  @IsNumber()
  @IsEnum([18, 21], { message: 'العيار يجب أن يكون 18 أو 21 فقط' })
  karat: number;

  @ApiProperty({
    example: '6a35d0ed889402772415d53c',
    description: 'ID التصنيف (خواتم، غوايش...) من موديول Categories',
  })
  @IsMongoId()
  @IsNotEmpty()
  category: string;

  @ApiPropertyOptional({
    example: 2,
    description: 'عدد القطع الكسر المشتراة (اختياري)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'العدد لا يمكن أن يكون بالسالب' })
  count?: number;

  @ApiProperty({
    example: 12.5,
    description: 'الوزن الصافي بالجرام لهذه القطع (إجباري)',
  })
  @IsNumber()
  @Min(0.001, { message: 'الوزن يجب أن يكون أكبر من صفر' })
  weight: number;
}
