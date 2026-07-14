import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ProfitLedgerService } from './profit-ledger.service';
import { LedgerQueryDto } from '../daily-ledger/dto/ledger-query.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('📈 Profit Intelligence Ledger (منظومة صافي الأرباح الاستراتيجية)')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@Controller('profits')
export class ProfitLedgerController {
  constructor(private readonly profitLedgerService: ProfitLedgerService) {}

  @Get('report')
  @Roles(Role.OWNER) // صلاحية الأونر فقط لحماية سرية أرباح المحل الكلية
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'جلب تقرير الأرباح الذكي والمؤشرات الاقتصادية المتقدمة للمحل',
  })
  async getProfitReport(@Query() query: LedgerQueryDto) {
    const report =
      await this.profitLedgerService.getAdvancedProfitReport(query);
    return {
      success: true,
      message:
        'تم احتساب وتحليل صافي الأرباح والمؤشرات الاستراتيجية بنجاح كامل',
      data: report,
    };
  }
}
