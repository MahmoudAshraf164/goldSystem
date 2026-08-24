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
    const userId = req.user?.userId || req.user?.sub;
    return this.barcodeSalesService.createInvoice(dto, userId);
  }

  @Get('invoices')
  @Roles(Role.OWNER, Role.Employee)
  @ApiOperation({
    summary: 'جلب جميع فواتير مبيعات الباركود',
    description:
      'استرجاع قائمة بكافة الفواتير النشطة وغير الملغاة مرتبة من الأحدث للأقدم مع بيانات العميل والبائع كـ Array مباشرة.',
  })
  @ApiOkResponse({ description: 'قائمة فواتير المبيعات' })
  async getInvoices() {
    return this.barcodeSalesService.findAllInvoices();
  }

  @Patch('invoices/:id')
  @Roles(Role.OWNER, Role.Employee)
  @ApiOperation({
    summary: 'تعديل فاتورة بيع بالباركود قائمة',
  })
  @ApiParam({
    name: 'id',
    description: 'معرف الفاتورة (MongoDB ObjectId)',
  })
  @ApiOkResponse({ description: 'تم تعديل الفاتورة بنجاح' })
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
  })
  @ApiParam({
    name: 'id',
    description: 'معرف الفاتورة (MongoDB ObjectId)',
  })
  @ApiOkResponse({ description: 'تفاصيل الفاتورة المطلوبة' })
  async getInvoiceById(@Param('id') id: string) {
    return this.barcodeSalesService.findInvoiceById(id);
  }

  @Patch('invoices/:id/cancel')
  @Roles(Role.OWNER, Role.Employee)
  @ApiOperation({
    summary: 'إلغاء فاتورة بيع واسترجاع المخزون والنقدية',
  })
  @ApiParam({
    name: 'id',
    description: 'معرف الفاتورة المراد إلغاؤها',
  })
  @ApiOkResponse({
    description: 'تم إلغاء الفاتورة وإرجاع المخزون والخزنة بنجاح',
  })
  async cancelInvoice(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    return this.barcodeSalesService.cancelInvoice(id, userId);
  }
}
