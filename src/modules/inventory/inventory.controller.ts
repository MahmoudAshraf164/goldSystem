// import {
//   Controller,
//   Get,
//   Post,
//   Body,
//   Param,
//   Delete,
//   UseGuards,
//   HttpCode,
//   HttpStatus,
//   Query,
//   Req,
//   Put,
// } from '@nestjs/common';
// import {
//   ApiTags,
//   ApiBearerAuth,
//   ApiOperation,
//   ApiQuery,
// } from '@nestjs/swagger';
// import { InventoryService } from './inventory.service';
// import { CreateInventoryDto } from './dto/create-inventory.dto';
// import { AddStockDto } from './dto/add-stock.dto';
// import { AuthGuard } from '../auth/guards/auth.guard';
// import { RolesGuard } from '../auth/guards/roles.guard';
// import { Roles } from '../../common/decorators/roles.decorator';
// import { Role } from '../../common/enums/role.enum';

// @ApiTags('Inventory (New Gold)')
// @ApiBearerAuth('access-token')
// @UseGuards(AuthGuard, RolesGuard)
// @Controller('inventory')
// export class InventoryController {
//   constructor(private readonly inventoryService: InventoryService) {}

//   @Post()
//   @Roles(Role.OWNER)
//   @HttpCode(HttpStatus.CREATED)
//   @ApiOperation({
//     summary:
//       'إضافة بضاعة جديدة للمخزن بحسبة التيكت الديناميكية واسم الشركة (للمالك فقط)',
//   })
//   async create(
//     @Body() createInventoryDto: CreateInventoryDto,
//     @Req() req: any,
//   ) {
//     const userId = req.user.userId || req.user.id;
//     const item = await this.inventoryService.create(createInventoryDto, userId);
//     return {
//       message:
//         'تم إضافة البضاعة للمخزن بنجاح واحتساب الصافي بناءً على نوع ورق الشركة وتعدادها',
//       data: item,
//     };
//   }

//   @Post(':id/restock')
//   @Roles(Role.OWNER)
//   @HttpCode(HttpStatus.OK)
//   @ApiOperation({
//     summary:
//       'تزويد كمية وأوزان إضافية على بضاعة موجودة بالرمز/الـ ID (للمالك فقط)',
//   })
//   async restock(
//     @Param('id') id: string,
//     @Body() addStockDto: AddStockDto,
//     @Req() req: any,
//   ) {
//     const userId = req.user.userId || req.user.id;
//     const item = await this.inventoryService.addStock(id, addStockDto, userId);
//     return {
//       message: 'تم إضافة الكمية والأوزان الجديدة إلى البضاعة بنجاح',
//       data: item,
//     };
//   }

//   @Put(':id')
//   @Roles(Role.OWNER)
//   @HttpCode(HttpStatus.OK)
//   @ApiOperation({
//     summary: 'تعديل بيانات وأوزان مجموعة ذهب في المخزن (للمالك فقط)',
//   })
//   async update(
//     @Param('id') id: string,
//     @Body() updateInventoryDto: any,
//     @Req() req: any,
//   ) {
//     const userId = req.user.userId || req.user.id;
//     const item = await this.inventoryService.update(
//       id,
//       updateInventoryDto,
//       userId,
//     );
//     return {
//       message: 'تم تحديث بيانات البضاعة بنجاح وإعادة توازن الصافي أوتوماتيكياً',
//       data: item,
//     };
//   }

//   @Get()
//   @Roles(Role.OWNER, Role.Employee)
//   @HttpCode(HttpStatus.OK)
//   @ApiQuery({ name: 'status', required: false, enum: ['ACTIVE', 'ARCHIVED'] })
//   @ApiQuery({ name: 'karat', required: false, enum: [18, 21, 24] })
//   @ApiQuery({
//     name: 'companyName',
//     required: false,
//     description: 'اسم الشركة للبحث والـ Filtration (مثل: انريا)',
//   })
//   @ApiOperation({
//     summary:
//       'عرض مخزون الذهب المتاح مع دعم الفلترة بالشركة أو العيار أو الحالة',
//   })
//   async findAll(
//     @Query('status') status?: string,
//     @Query('karat') karat?: string,
//     @Query('companyName') companyName?: string,
//   ) {
//     const karatNum = karat ? parseInt(karat) : undefined;
//     const inventory = await this.inventoryService.findAll(
//       status,
//       karatNum,
//       companyName,
//     );
//     return {
//       message: 'تم جلب بيانات المخزن بنجاح',
//       data: inventory,
//     };
//   }

//   @Get(':id')
//   @Roles(Role.OWNER, Role.Employee)
//   @HttpCode(HttpStatus.OK)
//   @ApiOperation({
//     summary: 'تفاصيل قطعة/مجموعة ذهب معينة بالـ ID',
//   })
//   async findOne(@Param('id') id: string) {
//     const item = await this.inventoryService.findById(id);
//     return {
//       message: 'تم جلب تفاصيل القطعة بنجاح',
//       data: item,
//     };
//   }

//   @Delete(':id')
//   @Roles(Role.OWNER)
//   @HttpCode(HttpStatus.OK)
//   @ApiOperation({
//     summary: 'أرشفة وحذف قطعة ذهب ناعماً من المخزن (للمالك فقط)',
//   })
//   async remove(@Param('id') id: string) {
//     await this.inventoryService.softDelete(id);
//     return {
//       message: 'تم نقل البضاعة إلى الأرشيف بنجاح',
//     };
//   }
// }
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
  Req,
  Put,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('Inventory (New Gold)')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post()
  @Roles(Role.OWNER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'إنشاء مجموعة مخزون جديدة وتجهيزها للتكويد (للمالك فقط)',
  })
  async create(
    @Body() createInventoryDto: CreateInventoryDto,
    @Req() req: any,
  ) {
    const userId = req.user.userId || req.user.id;
    const item = await this.inventoryService.create(createInventoryDto, userId);
    return {
      message: 'تم إنشاء مجموعة المخزون بنجاح وجاهزة لتكويد قطع الباركود عليها',
      data: item,
    };
  }

  @Put(':id')
  @Roles(Role.OWNER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'تعديل البيانات الأساسية لمجموعة المخزون (للمالك فقط)',
  })
  async update(
    @Param('id') id: string,
    @Body() updateInventoryDto: UpdateInventoryDto,
    @Req() req: any,
  ) {
    const userId = req.user.userId || req.user.id;
    const item = await this.inventoryService.update(
      id,
      updateInventoryDto,
      userId,
    );
    return {
      message: 'تم تحديث بيانات المجموعة بنجاح',
      data: item,
    };
  }

  @Get()
  @Roles(Role.OWNER, Role.Employee)
  @HttpCode(HttpStatus.OK)
  @ApiQuery({ name: 'status', required: false, enum: ['ACTIVE', 'ARCHIVED'] })
  @ApiQuery({ name: 'karat', required: false, enum: [18, 21, 24] })
  @ApiQuery({
    name: 'companyName',
    required: false,
    description: 'اسم الشركة للبحث والفلترة',
  })
  @ApiOperation({
    summary: 'عرض مجموعات المخزون المتاحة مع إحصائيات الأوزان والقطع المتراكمة',
  })
  async findAll(
    @Query('status') status?: string,
    @Query('karat') karat?: string,
    @Query('companyName') companyName?: string,
  ) {
    const karatNum = karat ? parseInt(karat) : undefined;
    const inventory = await this.inventoryService.findAll(
      status,
      karatNum,
      companyName,
    );
    return {
      message: 'تم جلب بيانات المخزن بنجاح',
      data: inventory,
    };
  }

  @Get(':id')
  @Roles(Role.OWNER, Role.Employee)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'تفاصيل مجموعة مخزون معينة بالـ ID',
  })
  async findOne(@Param('id') id: string) {
    const item = await this.inventoryService.findById(id);
    return {
      message: 'تم جلب تفاصيل المجموعة بنجاح',
      data: item,
    };
  }

  @Delete(':id')
  @Roles(Role.OWNER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'أرشفة مجموعة المخزون (للمالك فقط - بشرط عدم وجود قطع متبقية)',
  })
  async remove(@Param('id') id: string) {
    await this.inventoryService.softDelete(id);
    return {
      message: 'تم نقل مجموعة المخزون إلى الأرشيف بنجاح',
    };
  }
}