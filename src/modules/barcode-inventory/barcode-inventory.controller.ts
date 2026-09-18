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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';
import { BarcodeInventoryService } from './barcode-inventory.service';
import { CreateBarcodeItemDto } from './dto/create-barcode-item.dto';
import { UpdateBarcodeItemDto } from './dto/update-barcode-item.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CloudinaryService } from '../../common/cloudinary.service';

@ApiTags('مخزون الباركود (Barcode Inventory)')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@Controller('barcode-inventory')
export class BarcodeInventoryController {
  constructor(
    private readonly barcodeInventoryService: BarcodeInventoryService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  async createItem(
    @UploadedFile() file: any,
    @Body() dto: CreateBarcodeItemDto,
    @Request() req: any,
  ) {
    let imageUrl: string | null = null;

    if (file) {
      // نحدد اسم الملف بناءً على الباركود الممرر أو نتركه يتولد تلقائياً
      const customId = dto.barcode ? `item_${dto.barcode.trim()}` : undefined;
      imageUrl = await this.cloudinaryService.uploadImage(
        file,
        'gold_barcode_items',
        customId,
      );
    }

    const userId = req.user?.userId || req.user?.sub;
    return this.barcodeInventoryService.createItem(dto, userId, imageUrl);
  }

  @Get('scan/:barcode')
  @ApiOperation({ summary: 'فحص/قراءة قطعة بواسطة الباركود' })
  @ApiParam({ name: 'barcode', example: '20261001001' })
  @ApiOkResponse({ description: 'تم العثور على القطعة بنجاح' })
  async scanBarcode(@Param('barcode') barcode: string) {
    return this.barcodeInventoryService.findByBarcode(barcode);
  }

  @Get('archived')
  @ApiOperation({ summary: 'جلب قائمة القطع المؤرشفة/المحذوفة' })
  async findAllArchived() {
    return this.barcodeInventoryService.findAllArchived();
  }

  @Get()
  @ApiOperation({
    summary:
      'جلب قائمة القطع المتاحة بالمخزن مع إمكانية التصفية بـ العيار أو التصنيف',
  })
  @ApiQuery({ name: 'karat', required: false, enum: [18, 21, 24] })
  @ApiQuery({
    name: 'category',
    required: false,
    description: 'معرف التصنيف Mongo ObjectId',
  })
  async findAll(
    @Query('karat') karat?: string,
    @Query('category') category?: string,
  ) {
    const karatNum = karat ? parseInt(karat, 10) : undefined;
    return this.barcodeInventoryService.findAllAvailable(karatNum, category);
  }
  @Put(':id')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBarcodeItemDto,
    @UploadedFile() file: any,
    @Request() req: any,
  ) {
    let imageUrl: string | null = null;

    if (file) {
      // استخدام ID القطعة كاسم فريد للملف يضمن استبدال الصورة القديمة بنفس الاسم
      const customId = `item_${id}`;
      imageUrl = await this.cloudinaryService.uploadImage(
        file,
        'gold_barcode_items',
        customId,
      );
    }

    const userId = req.user?.userId || req.user?.sub;
    return this.barcodeInventoryService.updateItem(id, dto, userId, imageUrl);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'أرشفة/حذف مؤقت لقطعة من المخزن (Soft Delete)' })
  async remove(@Param('id') id: string, @Request() req: any) {
    await this.barcodeInventoryService.softDelete(id, req.user.userId);
    return { message: 'تم أرشفة القطعة بنجاح' };
  }

  @Get('print-tag/:barcode')
  @ApiOperation({ summary: 'توليد صورة باركود للطباعة' })
  async getPrintTag(@Param('barcode') barcode: string) {
    return this.barcodeInventoryService.generateBarcodeImage(barcode);
  }
}
