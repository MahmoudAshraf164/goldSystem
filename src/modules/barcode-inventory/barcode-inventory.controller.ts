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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
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
    summary: 'إضافة قطعة ذهب جديدة للمخزون بالباركود',
    description:
      'تسجيل قطعة جديدة في قاعدة البيانات، وتوليد باركود تلقائي إن لم يتم إرساله، مع حساب الوزن الصافي وتسجيل حركة مخزنية.',
  })
  @ApiCreatedResponse({ description: 'تم إضافة القطعة للمخزون بنجاح' })
  @ApiBadRequestResponse({ description: 'بيانات غير صالحة أو الباركود مكرر' })
  async create(@Body() dto: CreateBarcodeItemDto, @Request() req: any) {
    return this.barcodeInventoryService.createItem(dto, req.user.userId);
  }

  @Get('scan/:barcode')
  @ApiOperation({
    summary: 'فحص/قراءة قطعة بواسطة الباركود',
    description:
      'البحث عن القطعة الذهبية عبر رمز الباركود لاسترجاع بياناتها قبل البيع أو التعديل.',
  })
  @ApiParam({
    name: 'barcode',
    description: 'رمز الباركود الخاص بالقطعة',
    example: '20261001001',
  })
  @ApiOkResponse({ description: 'تم العثور على القطعة بنجاح' })
  @ApiNotFoundResponse({
    description: 'القطعة غير موجودة بالمخزن أو مباعة/مؤرشفة',
  })
  async scanBarcode(@Param('barcode') barcode: string) {
    return this.barcodeInventoryService.findByBarcode(barcode);
  }

  @Get('archived')
  @ApiOperation({
    summary: 'جلب قائمة القطع المؤرشفة/المحذوفة',
    description: 'استرجاع كافة القطع التي تمت أكل أرشفتاها (Soft Delete).',
  })
  @ApiOkResponse({ description: 'قائمة القطع المؤرشفة' })
  async findAllArchived() {
    return this.barcodeInventoryService.findAllArchived();
  }

  @Get()
  @ApiOperation({
    summary: 'جلب قائمة القطع المتاحة بالمخزن للبيع',
    description:
      'استعراض كافة القطع المتاحة (IN_STOCK) مع إمكانية التصفية بحسب العيار.',
  })
  @ApiQuery({
    name: 'karat',
    required: false,
    enum: [18, 21, 24],
    description: 'تصفية القائمة بذكر العيار (اختياري)',
  })
  @ApiOkResponse({ description: 'قائمة القطع المتاحة في المخزن' })
  async findAll(@Query('karat') karat?: string) {
    const karatNum = karat ? parseInt(karat, 10) : undefined;
    return this.barcodeInventoryService.findAllAvailable(karatNum);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'تعديل بيانات قطعة بالباركود',
    description: 'تحديث بيانات قطعة مخزنية محددة بواسطة المعرف ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'معرف القطعة (MongoDB ObjectId)',
    example: '60d5ecb8b5c9c22b4c8b4567',
  })
  @ApiOkResponse({ description: 'تم تحديث بيانات القطعة بنجاح' })
  @ApiNotFoundResponse({ description: 'القطعة غير موجودة' })
  @ApiBadRequestResponse({ description: 'بيانات التحديث غير صالحة' })
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateBarcodeItemDto>,
    @Request() req: any,
  ) {
    return this.barcodeInventoryService.updateItem(id, dto, req.user.userId);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'أرشفة/حذف مؤقت لقطعة من المخزن (Soft Delete)',
    description:
      'تحويل حالة القطعة إلى مؤرشفة دون حذفها نهائياً من قاعدة البيانات للحفاظ على السجلات.',
  })
  @ApiParam({
    name: 'id',
    description: 'معرف القطعة (MongoDB ObjectId)',
    example: '60d5ecb8b5c9c22b4c8b4567',
  })
  @ApiOkResponse({ description: 'تم أرشفة القطعة بنجاح' })
  @ApiNotFoundResponse({ description: 'القطعة غير موجودة' })
  async remove(@Param('id') id: string, @Request() req: any) {
    await this.barcodeInventoryService.softDelete(id, req.user.userId);
    return { message: 'تم أرشفة القطعة بنجاح' };
  }

  @Get('print-tag/:barcode')
  @ApiOperation({
    summary: 'توليد صورة باركود للطباعة',
    description:
      'إنشاء صورة باركود (Base64 / Data URL) قابلة للطباعة على التاج اللاصق للقطعة.',
  })
  @ApiParam({
    name: 'barcode',
    description: 'رمز الباركود المراد طباعته',
    example: '20261001001',
  })
  @ApiOkResponse({ description: 'صورة الباركود جاهزة للطباعة' })
  @ApiNotFoundResponse({ description: 'القطعة غير موجودة' })
  async getPrintTag(@Param('barcode') barcode: string) {
    return this.barcodeInventoryService.generateBarcodeImage(barcode);
  }
}
