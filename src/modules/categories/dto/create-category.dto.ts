import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'خواتم' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 50, { message: 'اسم التصنيف يجب أن يكون بين 2 إلى 50 حرفاً' })
  name: string;
}
