import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsMongoId } from 'class-validator';
import { Type } from 'class-transformer';

export class GetSilverItemsQueryDto {
  @ApiPropertyOptional({ description: 'عيار الفضة', example: 925 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  karat?: number;

  @ApiPropertyOptional({ description: 'معرف التصنيف (Category ObjectId)' })
  @IsOptional()
  @IsMongoId({ message: 'معرف التصنيف غير صالح' })
  categoryId?: string;
}