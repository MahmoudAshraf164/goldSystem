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
import { BullionPurchasesService } from './bullion-purchases.service';
import { CreateBullionPurchaseDto } from './dto/create-bullion-purchase.dto';
import { BullionPurchaseStatus } from './schemas/bullion-purchase.schema';

import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('إدارة شراء ومرتجعات السبايك والجنيهات (Bullion Purchases / Buyback)')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@Controller('bullion-purchases')
export class BullionPurchasesController {
  constructor(private readonly purchasesService: BullionPurchasesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.OWNER, Role.Employee)
  @ApiOperation({
    summary: 'إصدار فاتورة شراء سبايك/جنيهات من عميل (للمالك والموظف)',
    description:
      'إدخال السبايك المشتراة للمخزن وحساب سعر الذهب Pure والكاش باك المسترجع للعميل وتسجيل الحركة بالمخزن.',
  })
  @ApiResponse({
    status: 201,
    description: 'تمت إضافة الشراء وتحديث المخزون بنجاح.',
  })
  @ApiResponse({ status: 400, description: 'البيانات غير صالحة.' })
  async create(@Body() createDto: CreateBullionPurchaseDto, @Req() req: any) {
    const buyerId = req.user?.id || req.user?._id;
    return this.purchasesService.createPurchaseInvoice(createDto, buyerId);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(Role.OWNER, Role.Employee)
  @ApiOperation({
    summary:
      'عرض جميع فواتير الشراء والمرتجعات (المالك يرى الكل، الموظف يرى فواتيره فقط)',
  })
  @ApiQuery({
    name: 'status',
    enum: BullionPurchaseStatus,
    required: false,
    description: 'فلترة بحالة الفاتورة',
  })
  @ApiQuery({
    name: 'search',
    type: String,
    required: false,
    description: 'بحث برقم الفاتورة',
  })
  @ApiResponse({ status: 200, description: 'تم جلب فواتير الشراء بنجاح.' })
  async findAll(
    @Req() req: any,
    @Query('status') status?: BullionPurchaseStatus,
    @Query('search') search?: string,
  ) {
    return this.purchasesService.findAllInvoices(req.user, { status, search });
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.OWNER, Role.Employee)
  @ApiOperation({
    summary: 'عرض تفاصيل فاتورة شراء محددة (للمالك أو الموظف صاحب الفاتورة)',
  })
  @ApiParam({ name: 'id', description: 'معرف الفاتورة في قاعدة البيانات' })
  @ApiResponse({ status: 200, description: 'تم جلب التفاصيل بنجاح.' })
  @ApiResponse({ status: 403, description: 'غير مصرح بتصفح فاتورة موظف آخر.' })
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.purchasesService.findOneInvoice(id, req.user);
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.OWNER, Role.Employee)
  @ApiOperation({
    summary:
      'إلغاء فاتورة شراء سبايك وسحب الكمية من المخزن (للمالك أو الموظف صاحب الفاتورة)',
  })
  @ApiParam({ name: 'id', description: 'معرف الفاتورة المراد إلغاؤها' })
  @ApiResponse({
    status: 200,
    description: 'تم إلغاء الفاتورة وسحب الكمية من المخزن بنجاح.',
  })
  @ApiResponse({ status: 403, description: 'غير مصرح بإلغاء فاتورة موظف آخر.' })
  async cancel(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Req() req: any,
  ) {
    return this.purchasesService.cancelInvoice(id, req.user, reason);
  }
}
