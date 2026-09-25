import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Req,
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
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('🟠 Petty Expenses (المصاريف النثرية والتشغيلية للمحل)')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @Roles(Role.OWNER, Role.Employee)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'تسجيل مصروف نثري أو مشتريات ذهب جديدة (خروج كاش مباشر من الخزنة)',
  })
  @ApiCreatedResponse({ description: 'تم تسجيل الحركة بنجاح' })
  async create(@Body() dto: CreateExpenseDto, @Req() req: any) {
    const userId = req.user.id || req.user._id || req.user.userId;
    const expense = await this.expensesService.createExpense(dto, userId);
    return {
      success: true,
      message: 'تم تسجيل حركة خروج النقدية النثرية بنجاح',
      data: expense,
    };
  }

  @Get()
  @Roles(Role.OWNER)
  @HttpCode(HttpStatus.OK)
  @ApiQuery({
    name: 'category',
    required: false,
    enum: ['GOLD_PURCHASE', 'SHOP_EXPENSES', 'SALARIES', 'OTHERS'],
    description:
      'فلترة الدفتر بناءً على تصنيف مالي محدد (مثال: الرواتب أو مشتريات الذهب)',
  })
  @ApiOperation({
    summary: 'عرض سجل الدفتر الورقي للمصاريف بالكامل مع الفلترة (للمالك فقط)',
  })
  async findAll(@Query('category') category?: string) {
    const expenses = await this.expensesService.findAll(category);
    return {
      success: true,
      data: expenses,
    };
  }

  @Get(':id')
  @Roles(Role.OWNER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'عرض تفاصيل مصروف محدد بالـ ID' })
  async findOne(@Param('id') id: string) {
    const expense = await this.expensesService.findOne(id);
    return {
      success: true,
      data: expense,
    };
  }

  @Patch(':id')
  @Roles(Role.OWNER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'تعديل بيانات مصروف وتسوية فارق المبلغ في الخزنة تلقائياً (للمالك فقط)',
  })
  @ApiOkResponse({ description: 'تم تعديل المصروف وتسوية الخزنة بنجاح' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
    @Req() req: any,
  ) {
    const userId = req.user.id || req.user._id || req.user.userId;
    const updatedExpense = await this.expensesService.updateExpense(
      id,
      dto,
      userId,
    );
    return {
      success: true,
      message: 'تم تعديل المصروف وتسوية الخزنة بنجاح',
      data: updatedExpense,
    };
  }

  @Delete(':id')
  @Roles(Role.OWNER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'حذف مصروف وإعادة قيمته بالكامل إلى الخزنة (للمالك فقط)',
  })
  @ApiOkResponse({ description: 'تم حذف المصروف وإعادة المبلغ للخزنة بنجاح' })
  async remove(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.id || req.user._id || req.user.userId;
    return this.expensesService.deleteExpense(id, userId);
  }
}