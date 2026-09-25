import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { IncomeService } from './income.service';
import { CreateIncomeDto } from './dto/create-income.dto';
import { UpdateIncomeDto } from './dto/update-income.dto';
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
    summary: 'إضافة دخل/إيراد جديد للدرج والتسميع في الخزنة',
  })
  @ApiCreatedResponse({ description: 'تم إضافة الدخل بنجاح' })
  async create(@Body() dto: CreateIncomeDto, @Req() req: any) {
    const userId = req.user.id || req.user._id || req.user.userId;
    const income = await this.incomeService.createIncome(dto, userId);
    return {
      success: true,
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
      success: true,
      message: 'تم جلب سجل الإيرادات بنجاح',
      data: incomes,
    };
  }

  @Get(':id')
  @Roles(Role.OWNER, Role.Employee)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'عرض تفاصيل إيراد محدد بالـ ID' })
  async findOne(@Param('id') id: string) {
    const income = await this.incomeService.findOne(id);
    return {
      success: true,
      data: income,
    };
  }

  @Patch(':id')
  @Roles(Role.OWNER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'تعديل بيانات إيراد وتسوية فارق المبلغ في الخزنة (للمالك فقط)',
  })
  @ApiOkResponse({ description: 'تم تعديل الإيراد وتسوية الخزنة بنجاح' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateIncomeDto,
    @Req() req: any,
  ) {
    const userId = req.user.id || req.user._id || req.user.userId;
    const updatedIncome = await this.incomeService.updateIncome(
      id,
      dto,
      userId,
    );
    return {
      success: true,
      message: 'تم تعديل الإيراد وتسوية الخزنة بنجاح',
      data: updatedIncome,
    };
  }

  @Delete(':id')
  @Roles(Role.OWNER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'حذف إيراد وخصم قيمته الملغاة من الخزنة (للمالك فقط)',
  })
  @ApiOkResponse({ description: 'تم حذف الإيراد وخصم المبلغ من الخزنة بنجاح' })
  async remove(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.id || req.user._id || req.user.userId;
    return this.incomeService.deleteIncome(id, userId);
  }
}