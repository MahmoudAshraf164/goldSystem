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
import { BarcodeInventoryService } from './barcode-inventory.service';
import { CreateBarcodeItemDto } from './dto/create-barcode-item.dto';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller('barcode-inventory')
@UseGuards(AuthGuard)
export class BarcodeInventoryController {
  constructor(
    private readonly barcodeInventoryService: BarcodeInventoryService,
  ) {}

  @Post()
  async create(@Body() dto: CreateBarcodeItemDto, @Request() req: any) {
    return this.barcodeInventoryService.createItem(dto, req.user.userId);
  }

  @Get('scan/:barcode')
  async scanBarcode(@Param('barcode') barcode: string) {
    return this.barcodeInventoryService.findByBarcode(barcode);
  }

  @Get('archived')
  async findAllArchived() {
    return this.barcodeInventoryService.findAllArchived();
  }

  @Get()
  async findAll(@Query('karat') karat?: string) {
    const karatNum = karat ? parseInt(karat, 10) : undefined;
    return this.barcodeInventoryService.findAllAvailable(karatNum);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateBarcodeItemDto>,
    @Request() req: any,
  ) {
    return this.barcodeInventoryService.updateItem(id, dto, req.user.userId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req: any) {
    await this.barcodeInventoryService.softDelete(id, req.user.userId);
    return { message: 'تم أرشفة القطعة بنجاح' };
  }
  
  @Get('print-tag/:barcode')
  async getPrintTag(@Param('barcode') barcode: string) {
    return this.barcodeInventoryService.generateBarcodeImage(barcode);
  }
}
