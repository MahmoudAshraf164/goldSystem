import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ScrapGoldService } from './scrap-gold.service';
import { BuyScrapDto } from './dto/buy-scrap.dto';

import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('Scrap Gold Management (ذهب الكسر - كسر الخزنة)')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.OWNER)
@Controller('scrap-gold')
export class ScrapGoldController {
  constructor(private readonly scrapGoldService: ScrapGoldService) {}

  @Get('balance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'عرض رصيد الذهب الكسر الحالي (عدد ووزن) بالتفصيل (للمالك فقط)',
  })
  async getBalance() {
    const balance = await this.scrapGoldService.getInventory();
    return {
      message: 'تم جلب رصيد الذهب الكسر بنجاح',
      data: balance,
    };
  }

  @Post('buy')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'شراء/إضافة ذهب كسر للمخزن مباشرة دون فاتورة (للمالك فقط)',
  })
  async buyScrap(@Body() buyScrapDto: BuyScrapDto, @Req() req: any) {
    const userId = req.user.id;
    const updated = await this.scrapGoldService.buyScrap(buyScrapDto, userId);
    return {
      message: 'تم إضافة الكسر للمخزن وتحديث سجل التحركات بنجاح',
      data: updated,
    };
  }
}
