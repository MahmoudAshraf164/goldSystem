import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { Customer, CustomerSchema } from './schemas/customer.schema';
import { Invoice, InvoiceSchema } from '../sales/schemas/invoice.schema';
import { BullionSale, BullionSaleSchema } from '../bullion-sales/schemas/bullion-sale.schema'; // 👈 استيراد سكيما السبايك

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Customer.name, schema: CustomerSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: BullionSale.name, schema: BullionSaleSchema }, // 👈 تسجيل سكيما السبايك هنا
    ]),
  ],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService, MongooseModule],
})
export class CustomersModule {}