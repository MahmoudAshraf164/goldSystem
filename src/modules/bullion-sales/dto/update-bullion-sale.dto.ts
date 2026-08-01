import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsMongoId,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateBullionSaleItemDto } from './create-bullion-sale.dto';

export class UpdateBullionSaleDto {
  @ApiPropertyOptional({
    example: '6a592fb38000377ca873b407',
    description: 'معرف العميل في حالة تغيير العميل (اختياري)',
  })
  @IsOptional()
  @IsMongoId({ message: 'معرف العميل يجب أن يكون ObjectId صحيح' })
  customerId?: string;

  @ApiPropertyOptional({
    type: [CreateBullionSaleItemDto],
    description: 'قائمة الأصناف المعدلة بالفاتورة بالكميات الجديدة',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBullionSaleItemDto)
  items?: CreateBullionSaleItemDto[];
}
