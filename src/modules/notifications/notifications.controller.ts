import {
  Controller,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('🟡 Live Notifications Engine (نظام الإشعارات ومراقبة الحركة)')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('history')
  @Roles(Role.OWNER) // جرد ومراجعة سجل التنبيهات الحية حكر على المالك فقط
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'جلب سجل التنبيهات والإشعارات اللحظية لعمليات البيع (للمالك فقط)',
  })
  async getHistory() {
    const history = await this.notificationsService.getNotificationsHistory();
    return {
      success: true,
      message: 'تم جلب سجل التنبيهات الحية بنجاح',
      data: history,
    };
  }
}
