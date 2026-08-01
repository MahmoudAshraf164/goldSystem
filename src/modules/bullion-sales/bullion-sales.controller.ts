import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { BullionSalesService } from './bullion-sales.service';
import { CreateBullionSaleDto } from './dto/create-bullion-sale.dto';
import { UpdateBullionSaleDto } from './dto/update-bullion-sale.dto';
import { BullionSaleStatus } from './schemas/bullion-sale.schema';

import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('إدارة فواتير بيع السبايك والجنيهات (Bullion Sales)')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@Controller('bullion-sales')
export class BullionSalesController {
  constructor(private readonly salesService: BullionSalesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.OWNER, Role.Employee)
  @ApiOperation({
    summary: 'إصدار فاتورة بيع سبايك/جنيهات جديدة (للمالك والموظف)',
    description:
      'إصدار فاتورة بيع جديدة وتحديث الكميات بالمخزن وتسجيل حركة الخروج فوراً بأسعار عيار 24 أو 21.',
  })
  @ApiResponse({
    status: 201,
    description: 'تم إصدار الفاتورة وتخصيم المخزون بنجاح.',
  })
  @ApiResponse({
    status: 400,
    description: 'الكمية غير متاحة بالمخزن أو البيانات غير صالحة.',
  })
  async create(@Body() createDto: CreateBullionSaleDto, @Req() req: any) {
    const sellerId = req.user?.id || req.user?._id;
    return this.salesService.createSaleInvoice(createDto, sellerId);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(Role.OWNER, Role.Employee)
  @ApiOperation({
    summary:
      'جلب جميع فواتير مبيعات السبايك والجنيهات (للمالك يعرض الكل، وللموظف يعرض فواتيره فقط)',
  })
  @ApiQuery({
    name: 'status',
    enum: BullionSaleStatus,
    required: false,
    description: 'فلترة حسب حالة الفاتورة',
  })
  @ApiQuery({
    name: 'search',
    type: String,
    required: false,
    description: 'بحث برقم الفاتورة أو العميل',
  })
  @ApiResponse({ status: 200, description: 'تم جلب الفواتير بنجاح.' })
  async findAll(
    @Req() req: any,
    @Query('status') status?: BullionSaleStatus,
    @Query('search') search?: string,
  ) {
    return this.salesService.findAllInvoices(req.user, { status, search });
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.OWNER, Role.Employee)
  @ApiOperation({
    summary: 'عرض تفاصيل فاتورة بيع محددة (للمالك أو للموظف الذي أصدرها)',
  })
  @ApiParam({ name: 'id', description: 'معرف الفاتورة في قاعدة البيانات' })
  @ApiResponse({ status: 200, description: 'تم جلب تفاصيل الفاتورة بنجاح.' })
  @ApiResponse({ status: 403, description: 'غير مصرح بتصفح فاتورة موظف آخر.' })
  @ApiResponse({ status: 404, description: 'الفاتورة غير موجودة.' })
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.salesService.findOneInvoice(id, req.user);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.OWNER, Role.Employee)
  @ApiOperation({
    summary:
      'تعديل فاتورة بيع سبايك / مرتجع جزئي (للمالك أو للموظف صاحب الفاتورة)',
  })
  @ApiParam({ name: 'id', description: 'معرف الفاتورة المراد تعديلها' })
  @ApiResponse({
    status: 200,
    description: 'تم تعديل الفاتورة وضبط المخزون بنجاح.',
  })
  @ApiResponse({ status: 403, description: 'غير مصرح بتعديل فاتورة موظف آخر.' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateBullionSaleDto,
    @Req() req: any,
  ) {
    return this.salesService.updateSaleInvoice(id, updateDto, req.user);
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.OWNER, Role.Employee) // 👈 إعطاء الصلاحية للموظف أيضاً ليكنسل فواتيره فقط
  @ApiOperation({
    summary:
      'إلغاء فاتورة بيع سبايك وإرجاع الكمية للمخزن (للمالك أو للموظف صاحب الفاتورة)',
  })
  @ApiParam({ name: 'id', description: 'معرف الفاتورة المراد إلغاؤها' })
  @ApiResponse({
    status: 200,
    description: 'تم إلغاء الفاتورة وإرجاع الأصناف للمخزن بنجاح.',
  })
  @ApiResponse({ status: 403, description: 'غير مصرح بإلغاء فاتورة موظف آخر.' })
  @ApiResponse({ status: 400, description: 'الفاتورة ملغاة بالفعل مسبقاً.' })
  async cancel(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Req() req: any,
  ) {
    return this.salesService.cancelInvoice(id, req.user, reason);
  }
}
