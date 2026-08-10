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
import { IncomeService } from './income.service';
import { CreateIncomeDto } from './dto/create-income.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('Incomes (الإيرادات/الدخل الإضافي)')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@Controller('incomes')
export class IncomeController {
  constructor(private readonly incomeService: IncomeService) {}

  @Post()
  @Roles(Role.OWNER, Role.Employee)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'إضافة دخل/إيراد جديد للدرج والتسميع في الـ Ledger',
  })
  async create(@Body() dto: CreateIncomeDto, @Req() req: any) {
    const userId = req.user.id;
    const income = await this.incomeService.createIncome(dto, userId);
    return {
      message: 'تم إضافة الدخل بنجاح وتحديث حركة الدرج أوتوماتيكياً',
      data: income,
    };
  }

  @Get()
  @Roles(Role.OWNER, Role.Employee)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'عرض سجل كافة الدخل والإيرادات المضافة' })
  async findAll() {
    const incomes = await this.incomeService.findAll();
    return {
      message: 'تم جلب سجل الإيرادات بنجاح',
      data: incomes,
    };
  }
}
