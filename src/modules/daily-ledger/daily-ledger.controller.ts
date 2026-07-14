import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DailyLedgerService } from './daily-ledger.service';
import { LedgerQueryDto } from './dto/ledger-query.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('👑 General Ledger & Audit (دفتر اليومية وجرد الأرصدة)')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@Controller('daily-ledger')
export class DailyLedgerController {
  constructor(private readonly ledgerService: DailyLedgerService) {}

  @Get('report')
  @Roles(Role.OWNER) // جرد الدفاتر والأموال الكلية حكر على المالك فقط
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'إحصائيات جرد الخزنة التراكمي والنقدي بجرامات العيارات (يومي/أسبوعي/شهري/مخصص)',
  })
  async getReport(@Query() query: LedgerQueryDto) {
    const report = await this.ledgerService.getLedgerReport(query);
    return {
      success: true,
      message: 'تم احتساب تقرير دفتر اليومية وتفنيط جرامات الجرد بنجاح تام',
      data: report,
    };
  }
}
