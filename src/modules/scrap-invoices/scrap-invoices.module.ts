import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScrapInvoicesService } from './scrap-invoices.service';
import { ScrapInvoicesController } from './scrap-invoices.controller';
import {
  ScrapInvoice,
  ScrapInvoiceSchema,
} from './schemas/scrap-invoice.schema';
import { Customer, CustomerSchema } from '../customers/schemas/customer.schema';
import {
  ScrapGold,
  ScrapGoldSchema,
} from '../scrap-gold/schemas/scrap-gold.schema';
import { StockMovementsModule } from '../stock-movements/stock-movements.module';
import { SafeModule } from '../safe/safe.module'; // 👈 استيراد موديول الخزنة

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ScrapInvoice.name, schema: ScrapInvoiceSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: ScrapGold.name, schema: ScrapGoldSchema },
    ]),
    StockMovementsModule,
    SafeModule, // 👈 حقن الخزنة هنا لربطها مالياً
  ],
  controllers: [ScrapInvoicesController],
  providers: [ScrapInvoicesService],
})
export class ScrapInvoicesModule {}
