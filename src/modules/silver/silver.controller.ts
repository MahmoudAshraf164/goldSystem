import {
  Controller,
  Post,
  Get,
  Patch,
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
  AdjustSilverSafeDto,
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

  @Post('items')
  @Roles(Role.OWNER, Role.Employee)
  @ApiOperation({ summary: 'إضافة قطعة جديدة إلى مخزون الفضة' })
  @ApiCreatedResponse({ description: 'تم إضافة القطعة للمخزون بنجاح' })
  async addItem(@Body() dto: CreateSilverItemDto) {
    return this.silverService.addSilverItem(dto);
  }

  @Get('items')
  @Roles(Role.OWNER, Role.Employee)
  @ApiOperation({ summary: 'عرض قطع الفضة المتاحة بالمخزن مع التصنيف الديناميكي' })
  @ApiOkResponse({ description: 'قائمة قطع الفضة المتاحة' })
  async getAvailableItems(
    @Query('karat') karat?: number,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.silverService.getAvailableItems(karat, categoryId);
  }

  @Post('sale/quick')
  @Roles(Role.OWNER, Role.Employee)
  @ApiOperation({
    summary: 'بيع قطعة فضة سريع مع إضافة بيانات العميل والتحديث الآلي للخزنة',
  })
  @ApiCreatedResponse({ description: 'تم البيع وإضافة المبلغ للخزنة بنجاح' })
  async quickSale(@Body() dto: QuickSilverSaleDto, @Request() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    return this.silverService.quickSale(dto, userId);
  }

  @Post('scrap/buy')
  @Roles(Role.OWNER, Role.Employee)
  @ApiOperation({ summary: 'شراء كسر فضة من زبون' })
  @ApiCreatedResponse({ description: 'تم تسجيل شراء الكسر وخصم المبلغ من الخزنة' })
  async buyScrap(@Body() dto: BuySilverScrapDto, @Request() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    return this.silverService.buyScrap(dto, userId);
  }

  @Get('safe/balance')
  @Roles(Role.OWNER, Role.Employee)
  @ApiOperation({ summary: 'عرض الرصيد النقدي الحالي لخزنة الفضة' })
  @ApiOkResponse({ description: 'رصيد خزنة الفضة النقدي' })
  async getSafeBalance() {
    return this.silverService.getSilverSafeBalance();
  }

  @Patch('safe/reset')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'تصفير خزنة الفضة بالكامل (تتطلب باسوورد الحماية)' })
  @ApiOkResponse({ description: 'تم تصفير الخزنة بنجاح' })
  async resetSafe(@Body() dto: AdjustSilverSafeDto, @Request() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    return this.silverService.resetSafe(dto, userId);
  }

  @Patch('safe/adjust')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'تعديل رصيد خزنة الفضة لقيمة معينة (تتطلب باسوورد الحماية)' })
  @ApiOkResponse({ description: 'تم تعديل رصيد الخزنة بنجاح' })
  async adjustSafeBalance(@Body() dto: AdjustSilverSafeDto, @Request() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    return this.silverService.adjustSafeBalance(dto, userId);
  }

  @Get('reports')
  @Roles(Role.OWNER, Role.Employee)
  @ApiOperation({ summary: 'تقارير حركة الفضة المالية والوزنية للفترة المحددة' })
  @ApiOkResponse({ description: 'تقرير مبيعات ومشتريات الفضة والخزنة' })
  async getReport(@Query() query: SilverReportQueryDto) {
    const start = query.startDate
      ? new Date(query.startDate)
      : new Date(new Date().setHours(0, 0, 0, 0));
    const end = query.endDate ? new Date(query.endDate) : new Date();

    return this.silverService.getSilverReport(start, end);
  }
}