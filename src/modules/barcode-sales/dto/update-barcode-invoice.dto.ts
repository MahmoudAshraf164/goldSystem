import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateBarcodeInvoiceDto } from './create-barcode-invoice.dto';

export class UpdateBarcodeInvoiceDto extends PartialType(
  CreateBarcodeInvoiceDto,
) {
  @ApiPropertyOptional({
    description:
      'معرف العميل (اختياري، يرسل في حال تغيير العميل المرتبط بالفاتورة)',
    example: '60d5ecb8b5c9c22b4c8b8888',
  })
  customerId?: string;
}
