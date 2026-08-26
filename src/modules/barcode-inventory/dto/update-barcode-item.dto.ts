import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsMongoId } from 'class-validator';
import { CreateBarcodeItemDto } from './create-barcode-item.dto';

export class UpdateBarcodeItemDto extends PartialType(CreateBarcodeItemDto) {
  @ApiPropertyOptional({
    description: 'معرف سجل المخزون الرئيسي (Mongo ObjectId)',
    example: '60d5ecb8b5c9c22b1c8e4111',
  })
  @IsOptional()
  @IsMongoId({ message: 'معرف المخزون الرئيسي يجب أن يكون ObjectId صحيح' })
  inventoryRef?: string;
}
