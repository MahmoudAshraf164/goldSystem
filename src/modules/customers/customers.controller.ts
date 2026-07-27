import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { UpdateUserDto } from '../users/dto/update-user.dto';

@ApiTags('Customers Management')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.OWNER, Role.Employee)
  @ApiOperation({ summary: 'إضافة عميل جديد في النظام (متاح للمالك والموظف)' })
  async create(@Body() createCustomerDto: CreateCustomerDto) {
    const customer = await this.customersService.create(createCustomerDto);
    return {
      message: 'تم تسجيل بيانات العميل بنجاح',
      data: customer,
    };
  }

  @Get(':id/statement')
  @Roles(Role.OWNER)
  // 👈 الـ Endpoint الجديدة لكشف حساب العميل
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'جلب كشف الحساب والسجل الكامل لمشتريات وفواتير العميل بالـ ID (للمالك والموظف)',
  })
  async getStatement(@Param('id') id: string) {
    const statement = await this.customersService.getCustomerStatement(id);
    return {
      message: 'تم جلب سجل العميل وكشف الحساب بنجاح',
      data: statement,
    };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['ACTIVE', 'ARCHIVED'],
    description: 'حالة العميل',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'البحث باسم العميل أو رقم هاتفه',
  })
  @ApiOperation({
    summary: 'عرض قائمة العملاء مع الفلترة والبحث (متاح للمالك والموظف)',
  })
  async findAll(
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const customers = await this.customersService.findAll(status, search);
    return {
      message: 'تم جلب قائمة العملاء بنجاح',
      data: customers,
    };
  }

  @Get(':id')
  @Roles(Role.OWNER, Role.Employee)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'عرض تفاصيل عميل محدد بالـ ID' })
  async findOne(@Param('id') id: string) {
    const customer = await this.customersService.findById(id);
    return {
      message: 'تم جلب بيانات العميل بنجاح',
      data: customer,
    };
  }

  @Put(':id')
  @Roles(Role.OWNER, Role.Employee)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تعديل بيانات عميل (متاح للمالك والموظف)' })
  async update(
    @Param('id') id: string,
    @Body() updateCustomerDto: UpdateCustomerDto, // 👈 تم تغيير النوع هنا إلى UpdateCustomerDto
  ) {
    const customer = await this.customersService.update(id, updateCustomerDto);
    return {
      message: 'تم تحديث بيانات العميل بنجاح',
      data: customer,
    };
  }

  @Delete(':id')
  @Roles(Role.OWNER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'حذف عميل ونقله للأرشيف ناعماً (للمالك فقط)' })
  async remove(@Param('id') id: string) {
    await this.customersService.softDelete(id);
    return {
      message: 'تم نقل حساب العميل إلى الأرشيف بنجاح',
    };
  }
}
