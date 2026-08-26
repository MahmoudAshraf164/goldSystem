import { PartialType } from '@nestjs/mapped-types';
import { CreateBarcodeItemDto } from './create-barcode-item.dto';

export class UpdateBarcodeItemDto extends PartialType(CreateBarcodeItemDto) {
  inventoryRef: any;
}
