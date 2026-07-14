import { PartialType } from '@nestjs/swagger';
import { CreateScrapInvoiceDto } from './create-scrap-invoice.dto';

export class UpdateScrapInvoiceDto extends PartialType(CreateScrapInvoiceDto) {}
