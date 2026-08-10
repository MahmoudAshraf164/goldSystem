import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ScrapGoldService } from './scrap-gold.service';
import { BuyScrapDto } from './dto/buy-scrap.dto';
import { UpdateScrapDto } from './dto/update-scrap.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('Scrap Gold Management (ذهب الكسر - كسر الخزنة)')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@Controller('scrap-gold')
export class ScrapGoldController {
  constructor(private readonly scrapGoldService: ScrapGoldService) {}

  @Get('balance')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.OWNER, Role.Employee)
  @ApiOperation({
    summary: 'عرض إجمالي أوزان الذهب الكسر في الخزنة لكل عيار (18 و 21)',
  })
  async getBalance() {
    const balance = await this.scrapGoldService.getInventory();
    return {
      message: 'تم جلب رصيد أوزان الكسر بنجاح',
      data: balance,
    };
  }

  @Post('buy')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.OWNER, Role.Employee)
  @ApiOperation({
    summary: 'إضافة وزن ذهب كسر للمخزن دون فاتورة (18 و 21)',
  })
  async buyScrap(@Body() buyScrapDto: BuyScrapDto, @Req() req: any) {
    const userId = req.user.id;
    const updated = await this.scrapGoldService.buyScrap(buyScrapDto, userId);
    return {
      message: 'تم إضافة وزن الكسر للخزنة وتحديث السجل بنجاح',
      data: updated,
    };
  }

  @Put('update')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.OWNER, Role.Employee)
  @ApiOperation({
    summary: 'تعديل وتصفية رصيد الكسر المباشر لعيار 18 أو 21 (تسوية جرد)',
  })
  async updateScrapBalance(
    @Body() updateScrapDto: UpdateScrapDto,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    const updated = await this.scrapGoldService.updateScrapBalance(
      updateScrapDto,
      userId,
    );
    return {
      message: 'تم تحديث رصيد الكسر وتسجيل الحركة بنجاح',
      data: updated,
    };
  }
}
