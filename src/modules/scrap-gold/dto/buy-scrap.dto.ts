import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, Min } from 'class-validator';

export class BuyScrapDto {
  @ApiProperty({ example: 21, enum: [18, 21, 24] })
  @IsNumber()
  @IsEnum([18, 21, 24], { message: 'العيار يجب أن يكون 18 أو 21 أو 24 فقط' })
  karat: number;

  @ApiProperty({
    example: 12.5,
    description: 'الوزن المراد إضافته بالجرام للعيار المحدد',
  })
  @IsNumber()
  @Min(0.001, { message: 'الوزن يجب أن يكون أكبر من صفر' })
  weight: number;
}
