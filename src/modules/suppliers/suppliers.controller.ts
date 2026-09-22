import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { RecordSupplierTransactionDto } from './dto/create-supplier-transaction.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator'; // 👈 تأكد من استدعاء ديكوريتور الـ Roles الخاص بك
import { Role } from '../../common/enums/role.enum';

@ApiTags('Suppliers')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.OWNER, Role.Employee) // 👈 تأكد من تحديد الأدوار المسموح لها بالوصول
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  @ApiOperation({ summary: 'إضافة مورد جديد' })
  async createSupplier(@Body() dto: CreateSupplierDto) {
    return this.suppliersService.createSupplier(dto);
  }

  @Get()
  @ApiOperation({ summary: 'عرض قائمة جميع الموردين' })
  async getAllSuppliers() {
    return this.suppliersService.getAllSuppliers();
  }

  @Get(':id/statement')
  @ApiOperation({ summary: 'كشف حساب المورد مع سجل المعاملات' })
  async getSupplierStatement(@Param('id') id: string) {
    return this.suppliersService.getSupplierStatement(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'تعديل بيانات مورد' })
  async updateSupplier(
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.suppliersService.updateSupplier(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'حذف مورد' })
  async deleteSupplier(@Param('id') id: string) {
    return this.suppliersService.deleteSupplier(id);
  }

  @Post('transaction')
  @ApiOperation({ summary: 'تسجيل حركة/معاملة جديدة مع المورد' })
  async recordTransaction(
    @Body() dto: RecordSupplierTransactionDto,
    @Req() req: any,
  ) {
    // جلب معرف المستخدم المستخرج من الـ Auth Guard بكل الاحتمالات الشائعة
    const userId = req.user?._id || req.user?.id || req.user?.sub;

    if (!userId) {
      throw new UnauthorizedException('تعذر التحقق من معرف المستخدم من التوكن');
    }

    return this.suppliersService.recordTransaction(dto, userId.toString());
  }
}