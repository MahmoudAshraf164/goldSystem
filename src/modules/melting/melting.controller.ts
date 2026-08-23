import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MeltingService } from './melting.service';
import { CreateMeltingDto } from './dto/create-melting.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('Gold Melting Management (تسييح وسبك الذهب الكسر)')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@Controller('melting')
export class MeltingController {
  constructor(private readonly meltingService: MeltingService) {}

  @Post('process')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.OWNER, Role.Employee)
  @ApiOperation({ summary: 'تسجيل عملية تسييح كسر وحساب الهالك والتسوية' })
  async processMelting(@Body() dto: CreateMeltingDto, @Req() req: any) {
    const userId = req.user.id;
    return this.meltingService.processMelting(dto, userId);
  }

  @Get('history')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.OWNER, Role.Employee)
  @ApiOperation({ summary: 'عرض سجل عمليات التسييح والهالك السابق' })
  async getMeltingHistory() {
    return this.meltingService.getMeltingHistory();
  }
}
