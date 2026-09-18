import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { RecordSupplierTransactionDto } from './dto/create-supplier-transaction.dto';

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  async createSupplier(@Body() dto: CreateSupplierDto) {
    return this.suppliersService.createSupplier(dto);
  }

  @Get()
  async getAllSuppliers() {
    return this.suppliersService.getAllSuppliers();
  }

  @Get(':id/statement')
  async getSupplierStatement(@Param('id') id: string) {
    return this.suppliersService.getSupplierStatement(id);
  }

  @Patch(':id')
  async updateSupplier(
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.suppliersService.updateSupplier(id, dto);
  }

  @Delete(':id')
  async deleteSupplier(@Param('id') id: string) {
    return this.suppliersService.deleteSupplier(id);
  }

  @Post('transaction')
  async recordTransaction(
    @Body() dto: RecordSupplierTransactionDto,
    @Req() req: any,
  ) {
    const userId = req.user?._id || 'SYSTEM_USER';
    return this.suppliersService.recordTransaction(dto, userId);
  }
}