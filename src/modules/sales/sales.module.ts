import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { Invoice, InvoiceSchema } from './schemas/invoice.schema';
import { StockMovementsModule } from '../stock-movements/stock-movements.module';
import {
  Inventory,
  InventorySchema,
} from '../inventory/schemas/inventory.schema';
import { Customer, CustomerSchema } from '../customers/schemas/customer.schema'; // 👈 استيراد الاسكيما هنا

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Inventory.name, schema: InventorySchema },
      { name: Customer.name, schema: CustomerSchema }, // 👈 حقن اسكيما العملاء هنا
    ]),
    StockMovementsModule,
  ],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
