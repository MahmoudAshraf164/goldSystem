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
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('مبيعات الباركود بالفواتير (Barcode Sales & Invoices)')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@Controller('barcode-sales')
export class BarcodeSalesController {
  constructor(private readonly barcodeSalesService: BarcodeSalesService) {}

  @Post('checkout')
  @Roles(Role.OWNER, Role.Employee)
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
  @Roles(Role.OWNER, Role.Employee)
  @ApiOperation({
    summary: 'جلب جميع فواتير مبيعات الباركود',
    description:
      'استرجاع قائمة بكافة الفواتير النشطة وغير الملغاة مرتبة من الأحدث للأقدم مع بيانات العميل والبائع.',
  })
  @ApiOkResponse({ description: 'قائمة فواتير المبيعات' })
  async getInvoices() {
    return this.barcodeSalesService.findAllInvoices();
  }

  @Patch('invoices/:id')
  @Roles(Role.OWNER, Role.Employee)
  @ApiOperation({
    summary: 'تعديل فاتورة بيع بالباركود قائمة',
    description:
      'تعديل أسعار الجرام أو المصنعيات أو إضافة/حذف قطع من الفاتورة مع التسوية الآلية للمخزون والخزنة وحركات المخزن.',
  })
  @ApiParam({
    name: 'id',
    description: 'معرف الفاتورة (MongoDB ObjectId)',
    example: '60d5ecb8b5c9c22b4c8b8888',
  })
  @ApiOkResponse({ description: 'تم تعديل الفاتورة بنجاح' })
  @ApiBadRequestResponse({
    description: 'البيانات غير صالحة أو الفاتورة ملغاة',
  })
  @ApiNotFoundResponse({ description: 'الفاتورة أو القطع غير موجودة' })
  async updateInvoice(
    @Param('id') id: string,
    @Body() dto: CreateBarcodeInvoiceDto,
    @Request() req: any,
  ) {
    const userId = req.user?.userId || req.user?.sub;
    return this.barcodeSalesService.updateInvoice(id, dto, userId);
  }

  @Get('invoices/:id')
  @Roles(Role.OWNER, Role.Employee)
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
  @Roles(Role.OWNER, Role.Employee)
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
