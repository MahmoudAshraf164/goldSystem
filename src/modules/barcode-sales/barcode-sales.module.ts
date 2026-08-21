import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BarcodeSalesController } from './barcode-sales.controller';
import { BarcodeSalesService } from './barcode-sales.service';
import {
  BarcodeInvoice,
  BarcodeInvoiceSchema,
} from './schemas/barcode-invoice.schema';
import { BarcodeInventoryModule } from '../barcode-inventory/barcode-inventory.module';
import { StockMovementsModule } from '../stock-movements/stock-movements.module';
import { SafeModule } from '../safe/safe.module';
import { CustomersModule } from '../customers/customers.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BarcodeInvoice.name, schema: BarcodeInvoiceSchema },
    ]),
    BarcodeInventoryModule,
    StockMovementsModule,
    SafeModule,
    CustomersModule,
    InventoryModule, // 👈 تم استيراد موديل المخزون العام للسماح بتسجيل الحركة والتزامن
  ],
  controllers: [BarcodeSalesController],
  providers: [BarcodeSalesService],
  exports: [BarcodeSalesService],
})
export class BarcodeSalesModule {}
