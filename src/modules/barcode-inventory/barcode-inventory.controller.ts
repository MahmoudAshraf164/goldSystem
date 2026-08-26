import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { BarcodeInventoryService } from './barcode-inventory.service';
import { CreateBarcodeItemDto } from './dto/create-barcode-item.dto';
import { UpdateBarcodeItemDto } from './dto/update-barcode-item.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('مخزون الباركود (Barcode Inventory)')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@Controller('barcode-inventory')
export class BarcodeInventoryController {
  constructor(
    private readonly barcodeInventoryService: BarcodeInventoryService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'إضافة قطعة جديدة بالباركود',
    description:
      'إدخال قطعة جديدة ومزامنتها تلقائياً مع المخزون العام وتسجيل حركة الحركة.',
  })
  @ApiCreatedResponse({ description: 'تم إنشاء القطعة بنجاح' })
  @ApiBadRequestResponse({ description: 'البيانات المدخلة غير صالحة' })
  async create(@Body() dto: CreateBarcodeItemDto, @Request() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    return this.barcodeInventoryService.createItem(dto, userId);
  }

  @Get('available')
  @ApiOperation({
    summary: 'جلب القطع المتاحة للبيع',
    description: 'عرض كافة قطع الباركود المتاحة غير المباعة والمفلترة بالعيار.',
  })
  @ApiQuery({
    name: 'karat',
    required: false,
    description: 'العيار (مثال: 21)',
  })
  @ApiOkResponse({ description: 'قائمة القطع المتاحة' })
  async findAllAvailable(@Query('karat') karat?: string) {
    const karatNumber = karat ? Number(karat) : undefined;
    return this.barcodeInventoryService.findAllAvailable(karatNumber);
  }

  @Get('archived')
  @ApiOperation({ summary: 'جلب القطع المؤرشفة/المحذوفة' })
  @ApiOkResponse({ description: 'قائمة القطع المؤرشفة' })
  async findAllArchived() {
    return this.barcodeInventoryService.findAllArchived();
  }

  @Get('barcode/:barcode')
  @ApiOperation({ summary: 'البحث عن قطعة بواسطة رقم الباركود' })
  @ApiParam({ name: 'barcode', description: 'رقم الباركود' })
  @ApiOkResponse({ description: 'تم العثور على القطعة' })
  @ApiNotFoundResponse({ description: 'القطعة غير موجودة' })
  async findByBarcode(@Param('barcode') barcode: string) {
    return this.barcodeInventoryService.findByBarcode(barcode);
  }

  @Get('barcode/:barcode/image')
  @ApiOperation({ summary: 'توليد صورة الباركود بصيغة Base64' })
  @ApiParam({ name: 'barcode', description: 'رقم الباركود' })
  @ApiOkResponse({ description: 'صورة الباركود Base64' })
  async generateBarcodeImage(@Param('barcode') barcode: string) {
    return this.barcodeInventoryService.generateBarcodeImage(barcode);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'تعديل بيانات قطعة بالباركود أو المعرف ID',
    description: 'تحديث بيانات قطعة مخزنية بواسطة الـ ID أو رقم الباركود.',
  })
  @ApiParam({
    name: 'id',
    description: 'معرف القطعة (MongoDB ObjectId أو رقم الباركود)',
    example: '21202600017',
  })
  @ApiOkResponse({ description: 'تم تحديث بيانات القطعة بنجاح' })
  @ApiNotFoundResponse({ description: 'القطعة غير موجودة' })
  @ApiBadRequestResponse({ description: 'بيانات التحديث غير صالحة' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBarcodeItemDto,
    @Request() req: any,
  ) {
    const userId = req.user?.userId || req.user?.sub;
    return this.barcodeInventoryService.updateItem(id, dto, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'حذف/أرشفة قطعة باركود وإلغاء وزنا من المخزون' })
  @ApiParam({ name: 'id', description: 'معرف القطعة ID' })
  @ApiOkResponse({ description: 'تم أرشفة القطعة وخصم وزنها بنجاح' })
  async remove(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    return this.barcodeInventoryService.softDelete(id, userId);
  }
}
