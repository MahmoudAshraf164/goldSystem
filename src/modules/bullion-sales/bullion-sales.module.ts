import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullionSale, BullionSaleSchema } from './schemas/bullion-sale.schema';
import { BullionSalesService } from './bullion-sales.service';
import { BullionSalesController } from './bullion-sales.controller';
import { BullionInventoryModule } from '../bullion-inventory/bullion-inventory.module';
import { StockMovementsModule } from '../stock-movements/stock-movements.module';
import { Customer, CustomerSchema } from '../customers/schemas/customer.schema';
import { CustomersModule } from '../customers/customers.module';
import { SafeModule } from '../safe/safe.module'; // 👈 استيراد موديول الخزنة

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BullionSale.name, schema: BullionSaleSchema },
      { name: Customer.name, schema: CustomerSchema },
    ]),
    BullionInventoryModule,
    StockMovementsModule,
    CustomersModule,
    SafeModule, // 👈 إضافته هنا ليصبح متاحاً للاستخدام
  ],
  controllers: [BullionSalesController],
  providers: [BullionSalesService],
  exports: [BullionSalesService],
})
export class BullionSalesModule {}
