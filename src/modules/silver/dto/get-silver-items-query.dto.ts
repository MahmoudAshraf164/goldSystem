import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GetSilverItemsQueryDto {
  @ApiPropertyOptional({ description: 'عيار الفضة اختيارياً (مثل: 925)' })
  @IsOptional()
  @IsString()
  karat?: string;

  @ApiPropertyOptional({
    description: 'معرف التصنيف اختيارياً (Category ObjectId)',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'البحث باسم القطعة' })
  @IsOptional()
  @IsString()
  search?: string;
}
