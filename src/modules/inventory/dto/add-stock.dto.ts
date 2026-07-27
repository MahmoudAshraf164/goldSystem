import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  Min,
  IsArray,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TagDetailDto } from './create-inventory.dto';

export class AddStockDto {
  @ApiProperty({ example: 2, description: 'عدد القطع المضافة' })
  @IsNumber()
  @Min(1, { message: 'يجب إضافة قطعة واحدة على الأقل' })
  count: number;

  @ApiProperty({ example: 15.5, description: 'الوزن القائم للقطع المضافة' })
  @IsNumber()
  @Min(0.001, { message: 'الوزن القائم المضاف يجب أن يكون أكبر من صفر' })
  grossWeight: number;

  @ApiPropertyOptional({
    type: [TagDetailDto],
    description: 'تفاصيل أوزان التيكت للدفعة الجديدة (اختياري)',
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => TagDetailDto)
  tagDetails?: TagDetailDto[];
}
