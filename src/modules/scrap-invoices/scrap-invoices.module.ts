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
import {
  Category,
  CategorySchema,
} from '../categories/schemas/category.schema'; // 👈 تأكد من استيرادها هنا
import { StockMovementsModule } from '../stock-movements/stock-movements.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ScrapInvoice.name, schema: ScrapInvoiceSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: ScrapGold.name, schema: ScrapGoldSchema },
      { name: Category.name, schema: CategorySchema }, // 👈 إجبارية هنا عشان الـ Service يستعلم عنها!
    ]),
    StockMovementsModule,
  ],
  controllers: [ScrapInvoicesController],
  providers: [ScrapInvoicesService],
})
export class ScrapInvoicesModule {}
