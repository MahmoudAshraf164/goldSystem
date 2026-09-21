import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SilverService } from './silver.service';
import {
  CreateSilverItemDto,
  QuickSilverSaleDto,
  BuySilverScrapDto,
  SilverReportQueryDto,
} from './dto/silver.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('إدارة الفضة (Silver Management)')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@Controller('silver')
export class SilverController {
  constructor(private readonly silverService: SilverService) {}

  // 1. إضافة قطعة للمخزون
  @Post('items')
  @Roles(Role.OWNER, Role.Employee)
  @ApiOperation({ summary: 'إضافة قطعة جديدة إلى مخزون الفضة' })
  @ApiCreatedResponse({ description: 'تم إضافة القطعة للمخزون بنجاح' })
  async addItem(@Body() dto: CreateSilverItemDto) {
    return this.silverService.addSilverItem(dto);
  }

  // 2. عرض المخزون المتاح
  @Get('items')
  @Roles(Role.OWNER, Role.Employee)
  @ApiOperation({ summary: 'عرض قطع الفضة المتاحة بالمخزن' })
  @ApiOkResponse({ description: 'قائمة قطع الفضة المتاحة' })
  async getAvailableItems(
    @Query('karat') karat?: number,
    @Query('category') category?: string,
  ) {
    return this.silverService.getAvailableItems(karat, category);
  }

  // 3. بيع سريع بدون فاتورة
  @Post('sale/quick')
  @Roles(Role.OWNER, Role.Employee)
  @ApiOperation({
    summary: 'بيع قطعة فضة سريع (بدون فاتورة)',
    description: 'يخصم القطعة من المخزون ويضيف المبلغ تلقائياً لخزنة الفضة.',
  })
  @ApiCreatedResponse({ description: 'تم البيع وإضافة المبلغ للخزنة بنجاح' })
  async quickSale(@Body() dto: QuickSilverSaleDto, @Request() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    return this.silverService.quickSale(dto.itemId, dto.pricePerGram, userId);
  }

  // 4. شراء كسر فضة من زبون
  @Post('scrap/buy')
  @Roles(Role.OWNER, Role.Employee)
  @ApiOperation({
    summary: 'شراء كسر فضة من زبون',
    description: 'يسجل الشراء ويخصم القيمة المدفوعة من خزنة الفضة.',
  })
  @ApiCreatedResponse({ description: 'تم تسجيل شراء الكسر وخصم المبلغ من الخزنة' })
  async buyScrap(@Body() dto: BuySilverScrapDto, @Request() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    return this.silverService.buyScrap(dto, userId);
  }

  // 5. تقرير مالي ووزني (يومي / أسبوعي / شهري)
  @Get('reports')
  @Roles(Role.OWNER, Role.Employee)
  @ApiOperation({ summary: 'تقارير حركة الفضة المالية والوزنية للفترة المحددة' })
  @ApiOkResponse({ description: 'تقرير مبيعات ومشتريات الفضة والخزنة' })
  async getReport(@Query() query: SilverReportQueryDto) {
    const start = query.startDate
      ? new Date(query.startDate)
      : new Date(new Date().setHours(0, 0, 0, 0)); // بداية اليوم الحالي افتراضياً
    const end = query.endDate ? new Date(query.endDate) : new Date();

    return this.silverService.getSilverReport(start, end);
  }

  // 6. استعلام رصيد خزنة الفضة الحالي
  @Get('safe/balance')
  @Roles(Role.OWNER, Role.Employee)
  @ApiOperation({ summary: 'عرض الرصيد النقدي الحالي الخاص بخزنة الفضة فقط' })
  @ApiOkResponse({ description: 'رصيد خزنة الفضة النقدي' })
  async getSafeBalance() {
    return this.silverService.getSilverSafeBalance();
  }
}