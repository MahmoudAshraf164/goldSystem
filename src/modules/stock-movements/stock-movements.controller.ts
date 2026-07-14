import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { StockMovementsService } from './stock-movements.service';

import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('Stock Movements Logs (سجل تحركات الجرد)')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@Controller('stock-movements')
export class StockMovementsController {
  constructor(private readonly movementsService: StockMovementsService) {}

  @Get()
  @Roles(Role.OWNER) // المالك فقط من له حق مراقبة حركة الجرد السرية للمحل
  @HttpCode(HttpStatus.OK)
  @ApiQuery({
    name: 'inventoryItem',
    required: false,
    description: 'فلترة حركة قطعة/مجموعة معينة بالـ ID',
  })
  @ApiOperation({ summary: 'عرض السجل التاريخي لتحركات المخزن (للمالك فقط)' })
  async getLogs(@Query('inventoryItem') inventoryItem?: string) {
    const logs = await this.movementsService.getMovements(inventoryItem);
    return {
      message: 'تم جلب سجل تحركات المخزن بنجاح',
      data: logs,
    };
  }
}
