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
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { ScrapInvoicesService } from './scrap-invoices.service';
import { CreateScrapInvoiceDto } from './dto/create-scrap-invoice.dto';
import { UpdateScrapInvoiceDto } from './dto/update-scrap-invoice.dto';

import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('🔴 Sales & Invoices (منظومة البيع والفواتير - ذهب الكسر)')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@Controller('scrap-invoices')
export class ScrapInvoicesController {
  constructor(private readonly scrapInvoicesService: ScrapInvoicesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'إصدار فاتورة بيع ذهب كسر لزبون بالوزن وخصمه من الخزنة تلقائياً مع توريد الكاش',
  })
  async createInvoice(@Body() dto: CreateScrapInvoiceDto, @Req() req: any) {
    const userId = req.user.id;
    const invoice = await this.scrapInvoicesService.createInvoice(dto, userId);
    return {
      message:
        'تم إصدار فاتورة بيع الكسر واحتساب الإجمالي وتحديث وزن ومادية الخزنة بنجاح',
      data: invoice,
    };
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.OWNER, Role.Employee)
  @ApiOperation({
    summary:
      'تعديل بيانات فاتورة بيع كسر وإعادة اتزان أوزان وكاش الخزنة تلقائياً',
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
        'تم تحديث فاتورة الكسر وإعادة ضبط الأوزان والفروقات المالية بالخزنة بنجاح',
      data: invoice,
    };
  }

  @Put(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.OWNER, Role.Employee)
  @ApiOperation({
    summary:
      'إلغاء فاتورة بيع كسر وإعادة الوزن للمخزن مع استرداد الكاش من الخزينة',
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
        '❌ تم إلغاء فاتورة الكسر بالكامل، وإرجاع الوزن واسترداد الكاش للخزنة بنجاح',
      data: invoice,
    };
  }

  @Get()
  @Roles(Role.OWNER, Role.Employee)
  @HttpCode(HttpStatus.OK)
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['COMPLETED', 'CANCELLED'],
  })
  @ApiQuery({ name: 'invoiceNumber', required: false })
  @ApiQuery({
    name: 'customerName',
    required: false,
    description: 'البحث باسم العميل',
  })
  @ApiQuery({
    name: 'customerPhone',
    required: false,
    description: 'البحث برقم هاتف العميل',
  })
  @ApiOperation({
    summary:
      'عرض والبحث في فواتير مبيعات الذهب الكسر (بالاسم، الرقم، التليفون، الحالة)',
  })
  async findAll(
    @Query('status') status?: string,
    @Query('invoiceNumber') invoiceNumber?: string,
    @Query('customerName') customerName?: string,
    @Query('customerPhone') customerPhone?: string,
    @Req() req?: any,
  ) {
    const userId = req.user.id;
    const userRole = req.user.role;
    const invoices = await this.scrapInvoicesService.findAll(
      { status, invoiceNumber, customerName, customerPhone },
      userId,
      userRole,
    );
    return {
      message: 'تم جلب سجل فواتير مبيعات الكسر المحددة بنجاح',
      data: invoices,
    };
  }
}