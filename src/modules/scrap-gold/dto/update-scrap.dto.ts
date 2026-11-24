import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, Min } from 'class-validator';

export class UpdateScrapDto {
  @ApiProperty({ example: 21, enum: [18, 21, 24] })
  @IsNumber()
  @IsEnum([18, 21, 24], { message: 'العيار يجب أن يكون 18 أو 21 أو 24 فقط' })
  karat: number;

  @ApiProperty({ example: 50.0, description: 'الوزن الفعلي الجديد بعد الجرد' })
  @IsNumber()
  @Min(0, { message: 'الوزن لا يمكن أن يكون بالسالب' })
  newWeight: number;
}
