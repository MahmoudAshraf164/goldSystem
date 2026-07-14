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
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

// الاستدعاءات الهندسية النظيفة والموحدة للمصادقة والحماية
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('Users & Employees')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard) // قفل وإلزام التوكن والأدوار على كل الـ Endpoints هنا
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('employee')
  @Roles(Role.OWNER) // المالك فقط من يضيف الموظفين
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'إضافة موظف جديد في المحل (للمالك فقط - بحد أقصى موظفين اثنين)',
  })
  async createEmployee(@Body() createUserDto: CreateUserDto) {
    const employee = await this.usersService.create(createUserDto);
    return {
      message: 'تم إنشاء حساب الموظف بنجاح، يمكنه الآن تسجيل الدخول ببياناته',
      data: employee,
    };
  }

  @Get('employees')
  @Roles(Role.OWNER) // المالك فقط من يرى الجرد والموظفين
  @HttpCode(HttpStatus.OK)
  @ApiQuery({
    name: 'status',
    required: false,
    description:
      'حالة الموظفين المراد جلبهم (ACTIVE لعرض الحاليين، ARCHIVED لعرض المؤرشفين/المحذوفين)',
    enum: ['ACTIVE', 'ARCHIVED'],
  })
  @ApiOperation({
    summary: 'عرض قائمة الموظفين (نشطين أو مؤرشفين بناءً على الفلتر)',
  })
  async getEmployees(@Query('status') status?: string) {
    const employees = await this.usersService.findAllEmployees(status);
    const isArchived = status?.toUpperCase() === 'ARCHIVED';
    return {
      message: isArchived
        ? 'تم جلب قائمة الموظفين المؤرشفين بنجاح'
        : 'تم جلب قائمة الموظفين النشطين بنجاح',
      data: employees,
    };
  }

  @Put(':id')
  @Roles(Role.OWNER) // المالك له الصلاحية لتحديث بياناته أو بيانات أي موظف وتغيير الباسورد
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'تعديل بيانات حساب أو تغيير كلمة المرور (للمالك فقط)',
  })
  async updateEmployee(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const updatedUser = await this.usersService.update(id, updateUserDto);
    return {
      message: 'تم تحديث البيانات بنجاح',
      data: updatedUser,
    };
  }

  @Delete('employee/:id')
  @Roles(Role.OWNER) // المالك فقط من يمكنه نقل موظف إلى الأرشيف
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'حذف موظف ونقله للأرشيف (للمالك فقط - حذف ناعم)' })
  async removeEmployee(@Param('id') id: string) {
    await this.usersService.softDeleteEmployee(id);
    return {
      message: 'تم حذف الموظف ونقل حسابه إلى الأرشيف بنجاح',
    };
  }
}
