import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsMongoId, IsNotEmpty, IsNumber, Min } from 'class-validator';

export class SellScrapDto {
  @ApiProperty({ example: 21, enum: [18, 21] })
  @IsNumber()
  @IsEnum([18, 21], { message: 'العيار يجب أن يكون 18 أو 21 فقط' })
  karat: number;

  @ApiProperty({
    example: '6a35d0ed889402772415d53c',
    description: 'ID التصنيف المراد بيعه',
  })
  @IsMongoId()
  @IsNotEmpty()
  category: string; // 👈 تحديد نوع القطعة المراد سحبها من الكسر

  @ApiProperty({ example: 1, description: 'عدد القطع الكسر المراد بيعها' })
  @IsNumber()
  @Min(1, { message: 'العدد يجب أن يكون قطعة واحدة على الأقل' })
  count: number;

  @ApiProperty({ example: 6.25, description: 'الوزن المراد خصمه بالجرام' })
  @IsNumber()
  @Min(0.001, { message: 'الوزن يجب أن يكون أكبر من صفر' })
  weight: number;
}
