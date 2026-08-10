import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, Min } from 'class-validator';

export class UpdateScrapDto {
  @ApiProperty({ example: 21, enum: [18, 21] })
  @IsNumber()
  @IsEnum([18, 21], { message: 'العيار يجب أن يكون 18 أو 21 فقط' })
  karat: number;

  @ApiProperty({
    example: 150.75,
    description: 'إجمالي الوزن الجديد المراد ضبط المخزون عليه بالجرام',
  })
  @IsNumber()
  @Min(0, { message: 'الوزن المحدث لا يمكن أن يكون بالسالب' })
  newWeight: number;
}
