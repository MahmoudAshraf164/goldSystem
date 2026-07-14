import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Query, // 👈 ضفنا الـ Query هنا لسحب الفلتر
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
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
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
  async create(@Body() dto: CreateExpenseDto, @Req() req: any) {
    const userId = req.user.id;
    const expense = await this.expensesService.createExpense(dto, userId);
    return {
      success: true,
      message: 'تم تسجيل حركة خروج النقدية النثرية بنجاح',
      data: expense,
    };
  }

  @Get()
  @Roles(Role.OWNER) // جرد الدفاتر التراكمي حكر على المالك فقط
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
}
