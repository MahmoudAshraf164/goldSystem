import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common'; // 👈 أضفنا Req هنا
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SafeService } from './safe.service';
import {
  UpdateSafeBalanceDto,
  SetupSafePasswordDto,
  ResetSafeDto,
} from './dto/safe-control.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('💰 منظومة الخزنة الحديدية والدرج الفوري (Safe Ledger)')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@Controller('safe')
export class SafeController {
  constructor(private readonly safeService: SafeService) {}

  @Get('status')
  @Roles(Role.OWNER)
  @ApiOperation({
    summary: 'رؤية رصيد الخزنة الحالي ومؤشر آخر تحديث وقتي بدون باسورد',
  })
  async getStatus() {
    const safe = await this.safeService.getSafeStatus();
    return { success: true, data: safe };
  }

  @Post('setup-password')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'إنشاء أو تعديل الباسورد السري الخاص بالخزنة' })
  async setupPassword(@Body() dto: SetupSafePasswordDto) {
    return this.safeService.setupSafePassword(dto);
  }

  @Put('adjust-balance')
  @Roles(Role.OWNER)
  @ApiOperation({
    summary: 'تعديل رصيد الخزنة يدوياً إلى رقم محدد (يتطلب باسورد الخزنة)',
  })
  async adjustBalance(
    @Body() dto: UpdateSafeBalanceDto,
    @Req() req: any, // 👈 استبدال GetUser بـ Req
  ) {
    const userId = req.user.id; // 👈 استخراج الآي دي هنا ديناميكياً
    const updatedSafe = await this.safeService.updateBalanceManually(
      dto,
      userId,
    );
    return {
      success: true,
      message: 'تم تعديل الرصيد بنجاح وتسجيل العملية بالدفاتر الميدانية',
      data: updatedSafe,
    };
  }

  @Post('reset')
  @Roles(Role.OWNER)
  @ApiOperation({
    summary: 'تصفير رصيد الخزنة بالكامل وجعلها (0) (يتطلب باسورد الخزنة)',
  })
  async resetSafe(
    @Body() dto: ResetSafeDto,
    @Req() req: any, // 👈 استبدال GetUser بـ Req
  ) {
    const userId = req.user.id; // 👈 استخراج الآي دي هنا ديناميكياً
    const updatedSafe = await this.safeService.resetSafe(dto, userId);
    return {
      success: true,
      message: 'تم تصفير الخزنة بالكامل وبدء الجرد الجديد',
      data: updatedSafe,
    };
  }
}
