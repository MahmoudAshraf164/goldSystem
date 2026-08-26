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
}
