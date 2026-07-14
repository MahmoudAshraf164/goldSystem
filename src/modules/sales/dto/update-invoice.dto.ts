import { PartialType } from '@nestjs/swagger';
import { CreateInvoiceDto } from './create-invoice.dto';

// الـ PartialType هيخلي الـ customer والـ items اختياريين أوتوماتيك للتحديث
// والـ totalPrice مش موجود هنا نهائياً، بالتالي السيرفر آمن تماماً
export class UpdateInvoiceDto extends PartialType(CreateInvoiceDto) {}
