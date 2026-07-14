import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PurchasesLedgerService } from './purchases-ledger.service';
import { PurchasesQueryDto } from './dto/purchases-query.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('🟤 Purchases & Outflows Ledger (دفتر المشتريات والخوارج الكلية)')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@Controller('purchases-ledger')
export class PurchasesLedgerController {
  constructor(
    private readonly purchasesLedgerService: PurchasesLedgerService,
  ) {}

  @Get('report')
  @Roles(Role.OWNER) // كشوف خوارج الخزنة للمالك فقط لحماية أسرار المحل
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'حساب وعرض مجموع المشتريات والخوارج الكاش والجرامات (يومي/أسبوعي/شهري/مخصص)',
  })
  async getOutflowsReport(@Query() query: PurchasesQueryDto) {
    const report = await this.purchasesLedgerService.getOutflowsReport(query);
    return {
      success: true,
      message: 'تم احتساب إجمالي المشتريات والمصاريف الخارجة من المحل بنجاح',
      data: report,
    };
  }
}
