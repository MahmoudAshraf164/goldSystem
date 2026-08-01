import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { BullionInventoryService } from './bullion-inventory.service';
import { CreateBullionDto } from './dto/create-bullion.dto';
import { UpdateBullionDto } from './dto/update-bullion.dto';
import { BullionType } from './schemas/bullion-inventory.schema';
import { AddQuantityDto } from './dto/add-quantity.dto';

import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('إدارة مخزن السبايك والجنيهات (Bullion Inventory)')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@Controller('bullion-inventory')
export class BullionInventoryController {
  constructor(private readonly bullionService: BullionInventoryService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.OWNER)
  @ApiOperation({
    summary: 'إضافة سبيكة أو جنيه جديد للمخزن (للمالك فقط)',
    description:
      'إنشاء قطعة سبيكة أو جنيه جديدة وتسجيل حركة مخزنية سريعة في سجل التحركات تلقائياً.',
  })
  @ApiResponse({
    status: 201,
    description: 'تم إضافة القطعة للمخزن وتسجيل الحركة بنجاح.',
  })
  @ApiResponse({ status: 400, description: 'بيانات المدخلات غير صحيحة.' })
  async create(@Body() createDto: CreateBullionDto, @Req() req: any) {
    const userId = req.user?.id || req.user?._id;
    return this.bullionService.createBullion(createDto, userId);
  }

  @Patch(':id/add-quantity')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.OWNER)
  @ApiOperation({
    summary: 'إضافة كمية شحنة جديدة لمنتج سبايك موجود بالفعل (للمالك والموظف)',
    description:
      'تزويد عدد القطع لمنتج سبيكة/جنيه محدد وتسجيل حركة الإدخال تلقائياً في حركة المخزن.',
  })
  @ApiParam({
    name: 'id',
    description: 'المعرّف الخاص بالقطعة في قاعدة البيانات',
  })
  @ApiResponse({
    status: 200,
    description: 'تمت إضافة الكمية وتسجيل الحركة بنجاح.',
  })
  @ApiResponse({ status: 400, description: 'الكمية المضافة غير صالحة.' })
  async addQuantity(
    @Param('id') id: string,
    @Body() dto: AddQuantityDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id || req.user?._id;
    return this.bullionService.addQuantityToBullion(
      id,
      dto.addedQuantity,
      userId,
    );
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(Role.OWNER, Role.Employee)
  @ApiOperation({
    summary: 'عرض جميع السبايك والجنيهات المتاحة بالمخزن (للمالك والموظف)',
    description:
      'إرجاع قائمة بكافة السبايك والجنيهات مع تصفية اختيارية حسب النوع، اسم الشركة، أو حالة الأرشيف.',
  })
  @ApiQuery({
    name: 'type',
    enum: BullionType,
    required: false,
    description: 'تصفية حسب نوع القطعة (INGOT أو COIN)',
  })
  @ApiQuery({
    name: 'companyName',
    type: String,
    required: false,
    description: 'فلترة باسم الشركة المصنعة (مثال: BTC)',
  })
  @ApiQuery({
    name: 'isArchived',
    type: Boolean,
    required: false,
    description: 'عرض العناصر المأرشفة (true/false) - الافتراضي false',
  })
  @ApiResponse({ status: 200, description: 'تم جلب القائمة بنجاح.' })
  async findAll(
    @Query('type') type?: BullionType,
    @Query('companyName') companyName?: string,
    @Query('isArchived') isArchived?: boolean,
  ) {
    return this.bullionService.findAllBullions({
      type,
      companyName,
      isArchived: isArchived ? isArchived.toString() === 'true' : false,
    });
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.OWNER, Role.Employee)
  @ApiOperation({
    summary: 'جلب تفاصيل سبيكة/جنيه محدد بالـ ID (للمالك والموظف)',
    description:
      'عرض بيانات السبيكة أو الجنيه بالتفصيل مع مصنعيتها وقيمة الكاش باك.',
  })
  @ApiParam({
    name: 'id',
    description: 'المعرّف الخاص بالقطعة في قاعدة البيانات',
  })
  @ApiResponse({ status: 200, description: 'تم جلب تفاصيل القطعة بنجاح.' })
  @ApiResponse({
    status: 404,
    description: 'السبيكة/الجنيه غير موجود بالمخزن.',
  })
  async findOne(@Param('id') id: string) {
    return this.bullionService.findOneBullion(id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.OWNER)
  @ApiOperation({
    summary: 'تعديل بيانات سبيكة/جنيه أو تعديل كميتها بالمخزن (للمالك فقط)',
    description:
      'تعديل أي خاصية للقطعة. في حالة تعديل الكمية يتم تسجيل الفرق تلقائياً كحركة مخزنية في سجل التحركات.',
  })
  @ApiParam({ name: 'id', description: 'المعرّف الخاص بالقطعة المراد تعديلها' })
  @ApiResponse({ status: 200, description: 'تم التعديل وتسجيل الحركة بنجاح.' })
  @ApiResponse({ status: 404, description: 'القطعة غير موجودة بالمخزن.' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateBullionDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id || req.user?._id;
    return this.bullionService.updateBullion(id, updateDto, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.OWNER)
  @ApiOperation({
    summary: 'أرشفة سبيكة/جنيه (حذف ناعم - للمالك فقط)',
    description:
      'إخفاء القطعة من قوائم البيع والمخزن الفعال بدون حذف تاريخها من الفواتير القديمة.',
  })
  @ApiParam({ name: 'id', description: 'المعرّف الخاص بالقطعة المراد أرشفتها' })
  @ApiResponse({ status: 200, description: 'تمت أرشفة القطعة بنجاح.' })
  @ApiResponse({ status: 404, description: 'القطعة غير موجودة.' })
  async archive(@Param('id') id: string) {
    return this.bullionService.archiveBullion(id);
  }
}
