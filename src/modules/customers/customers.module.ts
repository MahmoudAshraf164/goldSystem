import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { Customer, CustomerSchema } from './schemas/customer.schema';
import { Invoice, InvoiceSchema } from '../sales/schemas/invoice.schema';
import {
  BullionSale,
  BullionSaleSchema,
} from '../bullion-sales/schemas/bullion-sale.schema';
import {
  BarcodeInvoice,
  BarcodeInvoiceSchema,
} from '../barcode-sales/schemas/barcode-invoice.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Customer.name, schema: CustomerSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: BullionSale.name, schema: BullionSaleSchema },
      { name: BarcodeInvoice.name, schema: BarcodeInvoiceSchema },
    ]),
  ],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
