import {
  Controller,
  Get,
  Post,
  Put,
  Delete, // 👈 ضفنا Delete أو Put حسب رغبتك لعملية الإلغاء
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { SalesService } from './sales.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';

import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('Sales & Invoices')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post('invoice')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'إصدار فاتورة بيع جديدة تحتوي على قطعة واحدة أو عدة قطع (متاح للمالك والموظف)',
  })
  async createSale(
    @Body() createInvoiceDto: CreateInvoiceDto,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    const invoice = await this.salesService.createSale(
      createInvoiceDto,
      userId,
    );
    return {
      message:
        'تم إتمام عملية البيع وإصدار الفاتورة المتعددة القطع بنجاح وتحديث المخزن الجرد الفعلي',
      data: invoice,
    };
  }

  @Put('invoice/:id')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.OWNER, Role.Employee)
  @ApiOperation({
    summary:
      'تعديل بيانات وأصناف فاتورة بيع وإعادة ضبط أوزان المستودع (متاح للمالك والموظف لفواتيره)',
  })
  async updateInvoice(
    @Param('id') id: string,
    @Body() updateInvoiceDto: UpdateInvoiceDto,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    const userRole = req.user.role;
    const invoice = await this.salesService.updateInvoice(
      id,
      updateInvoiceDto,
      userId,
      userRole,
    );
    return {
      message:
        'تم تحديث الفاتورة وإعادة موازنة المخزن والجرد بنجاح كامل (الاسترجاع الجزئي مدمج تلقائياً)',
      data: invoice,
    };
  }

  // 🚨 الـ Endpoint الجديدة للإلغاء والاسترجاع الكلي للفاتورة
  @Put('invoice/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.OWNER, Role.Employee) // متاح للموظف أو المالك حسب الصلاحيات المتبعة لديك
  @ApiOperation({
    summary:
      'إلغاء واسترجاع الفاتورة بالكامل (إرجاع كل البضاعة للمخزن وتصفير الدخل المالي)',
  })
  async cancelInvoice(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.id;
    const invoice = await this.salesService.cancelInvoice(id, userId);
    return {
      message:
        '❌ تم إلغاء الفاتورة بالكامل، وإعادة شحن مخزون القطع ديناميكياً، وتصفير الدخل في خزينة اليومية بنجاح',
      data: invoice,
    };
  }

  @Get('invoices')
  @Roles(Role.OWNER, Role.Employee)
  @HttpCode(HttpStatus.OK)
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['COMPLETED', 'CANCELLED'],
  })
  @ApiQuery({
    name: 'invoiceNumber',
    required: false,
    description: 'البحث برقم فاتورة محدد',
  })
  @ApiOperation({
    summary:
      'عرض وتتبع كل فواتير مبيعات المحل (المالك يرى الكل، الموظف يرى فواتيره فقط)',
  })
  async getInvoices(
    @Query('status') status?: string,
    @Query('invoiceNumber') invoiceNumber?: string,
    @Req() req?: any,
  ) {
    const userId = req.user.id;
    const userRole = req.user.role;
    const invoices = await this.salesService.findAllInvoices(
      { status, invoiceNumber },
      userId,
      userRole,
    );
    return {
      message: 'تم جلب سجلات الفواتير بنجاح',
      data: invoices,
    };
  }
}
