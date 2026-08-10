import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { Invoice, InvoiceSchema } from './schemas/invoice.schema';
import { StockMovementsModule } from '../stock-movements/stock-movements.module';
import { SafeModule } from '../safe/safe.module'; // 👈 استيراد موديول الخزنة لربطه بالنظام تلقائياً
import {
  Inventory,
  InventorySchema,
} from '../inventory/schemas/inventory.schema';
import { Customer, CustomerSchema } from '../customers/schemas/customer.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Inventory.name, schema: InventorySchema },
      { name: Customer.name, schema: CustomerSchema },
    ]),
    StockMovementsModule,
    SafeModule, // 👈 حقن الموديول هنا لحل مشكلة الـ Dependency الخاص بـ SafeService
  ],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
