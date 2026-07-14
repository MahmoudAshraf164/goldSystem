import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsMongoId, IsNotEmpty, IsNumber, Min } from 'class-validator';

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
  category: string; // 👈 إلزام تحديد نوع القطعة المشتراة

  @ApiProperty({
    example: 2,
    description: 'عدد القطع الكسر المشتراة من هذا النوع',
  })
  @IsNumber()
  @Min(1, { message: 'العدد يجب أن يكون قطعة واحدة على الأقل' })
  count: number;

  @ApiProperty({
    example: 12.5,
    description: 'الوزن الصافي بالجرام لهذه القطع',
  })
  @IsNumber()
  @Min(0.001, { message: 'الوزن يجب أن يكون أكبر من صفر' })
  weight: number;
}
