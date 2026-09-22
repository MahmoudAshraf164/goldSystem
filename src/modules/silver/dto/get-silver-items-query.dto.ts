import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsMongoId } from 'class-validator';
import { Type } from 'class-transformer';

export class GetSilverItemsQueryDto {
  @ApiPropertyOptional({ description: 'عيار الفضة اختيارياً (مثل: 925)', example: 925 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'يجب أن يكون العيار رقماً صالحاً' })
  karat?: number;

  @ApiPropertyOptional({ description: 'معرف التصنيف اختيارياً (Category ObjectId)' })
  @IsOptional()
  @IsMongoId({ message: 'معرف التصنيف الممرر غير صالح' })
  categoryId?: string;
}