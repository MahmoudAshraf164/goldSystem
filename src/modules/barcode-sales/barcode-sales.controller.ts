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
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { BarcodeSalesService } from './barcode-sales.service';
import { CreateBarcodeInvoiceDto } from './dto/create-barcode-invoice.dto';
import { AuthGuard } from '../auth/guards/auth.guard';

@ApiTags('مبيعات الباركود بالفواتير (Barcode Sales & Invoices)')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('barcode-sales')
export class BarcodeSalesController {
  constructor(private readonly barcodeSalesService: BarcodeSalesService) {}

  @Post('checkout')
  @ApiOperation({
    summary: 'إتمام عملية بيع بالباركود وإصدار فاتورة',
    description:
      'تنفذ عملية بيع آمنة مع التعامل مع المبيعات المتعددة (ACID Transactions)، وتحديث حالة المخزن للقطع المباعة، وإضافة القيمة المالية للخزنة أوتوماتيكياً وتسجيل حركة المخزون.',
  })
  @ApiCreatedResponse({
    description: 'تم إتمام عملية البيع وإصدار الفاتورة بنجاح',
  })
  @ApiBadRequestResponse({
    description: 'القطعة مباعة سابقاً أو بيانات المدخلات غير صحيحة',
  })
  @ApiNotFoundResponse({
    description: 'القطعة غير موجودة بالمخزن أو العميل غير موجود',
  })
  async checkout(@Body() dto: CreateBarcodeInvoiceDto, @Request() req: any) {
    return this.barcodeSalesService.createInvoice(dto, req.user.userId);
  }

  @Get('invoices')
  @ApiOperation({
    summary: 'جلب جميع فواتير مبيعات الباركود',
    description:
      'استرجاع قائمة بكافة الفواتير النشطة وغير الملغاة مرتبة من الأحدث للأقدم مع بيانات العميل والبائع.',
  })
  @ApiOkResponse({ description: 'قائمة فواتير المبيعات' })
  async getInvoices() {
    return this.barcodeSalesService.findAllInvoices();
  }

  @Get('invoices/:id')
  @ApiOperation({
    summary: 'جلب تفاصيل فاتورة بيع بالباركود بواسطة الـ ID',
    description:
      'استرجاع تفاصيل فاتورة محددة مع جميع القطع الموجودة بها واسم البائع والعميل.',
  })
  @ApiParam({
    name: 'id',
    description: 'معرف الفاتورة (MongoDB ObjectId)',
    example: '60d5ecb8b5c9c22b4c8b8888',
  })
  @ApiOkResponse({ description: 'تفاصيل الفاتورة المطلوبة' })
  @ApiNotFoundResponse({ description: 'الفاتورة غير موجودة' })
  @ApiBadRequestResponse({ description: 'معرف الفاتورة غير صالح' })
  async getInvoiceById(@Param('id') id: string) {
    return this.barcodeSalesService.findInvoiceById(id);
  }

  @Patch('invoices/:id/cancel')
  @ApiOperation({
    summary: 'إلغاء فاتورة بيع واسترجاع المخزون والنقدية',
    description:
      'إلغاء الفاتورة، وإرجاع كافة قطاع الذهب للمخزن بحالة (IN_STOCK)، وإعادة خصم المبلغ المدفوع من الخزنة مع تسجيل الحركة المخزنية.',
  })
  @ApiParam({
    name: 'id',
    description: 'معرف الفاتورة المراد إلغاؤها',
    example: '60d5ecb8b5c9c22b4c8b8888',
  })
  @ApiOkResponse({
    description: 'تم إلغاء الفاتورة وإرجاع المخزون والخزنة بنجاح',
  })
  @ApiBadRequestResponse({ description: 'الفاتورة ملغاة بالفعل' })
  @ApiNotFoundResponse({ description: 'الفاتورة غير موجودة' })
  async cancelInvoice(@Param('id') id: string, @Request() req: any) {
    return this.barcodeSalesService.cancelInvoice(id, req.user.userId);
  }
}
