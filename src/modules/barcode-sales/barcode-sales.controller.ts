import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Request,
  Patch,
} from '@nestjs/common';
import { BarcodeSalesService } from './barcode-sales.service';
import { CreateBarcodeInvoiceDto } from './dto/create-barcode-invoice.dto';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller('barcode-sales')
@UseGuards(AuthGuard)
export class BarcodeSalesController {
  constructor(private readonly barcodeSalesService: BarcodeSalesService) {}

  @Post('checkout')
  async checkout(@Body() dto: CreateBarcodeInvoiceDto, @Request() req: any) {
    return this.barcodeSalesService.createInvoice(dto, req.user.userId);
  }

  @Get('invoices')
  async getInvoices() {
    return this.barcodeSalesService.findAllInvoices();
  }

  @Get('invoices/:id')
  async getInvoiceById(@Param('id') id: string) {
    return this.barcodeSalesService.findInvoiceById(id);
  }

  @Patch('invoices/:id/cancel')
  async cancelInvoice(@Param('id') id: string, @Request() req: any) {
    return this.barcodeSalesService.cancelInvoice(id, req.user.userId);
  }
}
