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
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';

import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator'; // 👈 تأكد من استدعاء ديكوريتور الـ Roles الخاص بك
import { Role } from '../../common/enums/role.enum';

@ApiTags('Categories')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @Roles(Role.OWNER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'إضافة تصنيف ذهب جديد (للمالك فقط)' })
  async create(@Body() createCategoryDto: CreateCategoryDto) {
    const category = await this.categoriesService.create(createCategoryDto);
    return {
      message: 'تم إضافة التصنيف بنجاح',
      data: category,
    };
  }

  @Put(':id')
  @Roles(Role.OWNER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'تعديل اسم تصنيف أو استرجاعه من الأرشيف (للمالك فقط)',
  })
  async update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    const category = await this.categoriesService.update(id, updateCategoryDto);
    return {
      message: 'تم تحديث التصنيف بنجاح',
      data: category,
    };
  }

  @Delete(':id')
  @Roles(Role.OWNER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'حذف تصنيف ناعماً ونقله للأرشيف (للمالك فقط)' })
  async remove(@Param('id') id: string) {
    await this.categoriesService.softDelete(id);
    return {
      message: 'تم أرشفة وحذف التصنيف ناعماً بنجاح',
    };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiQuery({
    name: 'status',
    required: false,
    description:
      'حالة التصنيفات (ACTIVE لعرض النشطة، ARCHIVED لعرض المؤرشفة في الأرشيف)',
    enum: ['ACTIVE', 'ARCHIVED'],
  })
  @ApiOperation({
    summary: 'عرض قائمة كل التصنيفات النشطة أو المؤرشفة بناءً على الفلتر',
  })
  async findAll(@Query('status') status?: string) {
    const categories = await this.categoriesService.findAllActive(status);
    const isArchived = status?.toUpperCase() === 'ARCHIVED';
    return {
      message: isArchived
        ? 'تم جلب التصنيفات المؤرشفة بنجاح'
        : 'تم جلب التصنيفات النشطة بنجاح',
      data: categories,
    };
  }
}
