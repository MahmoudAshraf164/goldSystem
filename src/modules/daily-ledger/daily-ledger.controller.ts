import {
  Controller,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DailyLedgerService } from './daily-ledger.service';
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
  @Roles(Role.OWNER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'تقرير جرد ومقارنة فوري ومقفل (اليوم / أمس / إجمالي السبعة أيام الفائتة كاملة) كاش وجرامات',
  })
  async getReport() {
    const report = await this.ledgerService.getLedgerReport();
    return {
      success: true,
      message:
        'تم احتساب مقارنة الجرد لليوم وأمس وإجمالي الأسبوع المنصرم بنجاح تام',
      data: report,
    };
  }
}
