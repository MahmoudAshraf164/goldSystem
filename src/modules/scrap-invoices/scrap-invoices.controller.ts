import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ScrapInvoicesService } from './scrap-invoices.service';
import { CreateScrapInvoiceDto } from './dto/create-scrap-invoice.dto';
import { UpdateScrapInvoiceDto } from './dto/update-scrap-invoice.dto';

import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('🔴 Sales & Invoices (منظومة البيع والفواتير الجديدة)')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@Controller('scrap-invoices')
export class ScrapInvoicesController {
  constructor(private readonly scrapInvoicesService: ScrapInvoicesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'إصدار فاتورة بيع ذهب كسر لزبون وخصمه من جرد الخزنة بحسابات الـ POS المالية (للمالك والموظف)',
  })
  async createInvoice(@Body() dto: CreateScrapInvoiceDto, @Req() req: any) {
    const userId = req.user.id;
    const invoice = await this.scrapInvoicesService.createInvoice(dto, userId);
    return {
      message:
        'تم إصدار فاتورة بيع الكسر واحتساب الإجمالي تلقائياً بنجاح وتحديث جرد الخزنة والـ History',
      data: invoice,
    };
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.OWNER, Role.Employee)
  @ApiOperation({
    summary:
      'تعديل بيانات وأصناف فاتورة بيع كسر وإعادة موازنة الخزنة تلقائياً (متاح للمالك والموظف لفواتيره والمالك للكل)',
  })
  async updateInvoice(
    @Param('id') id: string,
    @Body() dto: UpdateScrapInvoiceDto,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    const userRole = req.user.role;
    const invoice = await this.scrapInvoicesService.updateInvoice(
      id,
      dto,
      userId,
      userRole,
    );
    return {
      message:
        'تم تحديث فاتورة الكسر وإعادة احتساب الإجمالي وموازنة جرد الخزنة بنجاح كامل الحسابات',
      data: invoice,
    };
  }

  @Put(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.OWNER, Role.Employee) // 👈 إتاحة الزر للموظف لفواتيره وللمالك لكل الفواتير
  @ApiOperation({
    summary:
      'إلغاء فاتورة بيع كسر بالكامل (إرجاع الذهب للخزنة وتصفر القيمة المالية والنقدية الداخلة للمحل)',
  })
  async cancelInvoice(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.id;
    const userRole = req.user.role;
    const invoice = await this.scrapInvoicesService.cancelInvoice(
      id,
      userId,
      userRole,
    );
    return {
      message:
        '❌ تم إلغاء فاتورة الكسر بالكامل، وإرجاع البضاعة لجرد الخزنة، وتصفير الأثر المالي بنجاح',
      data: invoice,
    };
  }

  @Get()
  @Roles(Role.OWNER, Role.Employee)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'عرض فواتير مبيعات الذهب الكسر المسجلة (المالك يرى الكل، الموظف يرى فواتيره فقط)',
  })
  async findAll(@Req() req: any) {
    const userId = req.user.id;
    const userRole = req.user.role;
    const invoices = await this.scrapInvoicesService.findAll(userId, userRole);
    return {
      message: 'تم جلب سجل فواتير مبيعات الكسر المسموحة بنجاح',
      data: invoices,
    };
  }
}
