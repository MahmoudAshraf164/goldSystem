import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DailyLedgerService } from './daily-ledger.service';
import { DailyLedgerController } from './daily-ledger.controller';
import { Invoice, InvoiceSchema } from '../sales/schemas/invoice.schema';
import {
  ScrapInvoice,
  ScrapInvoiceSchema,
} from '../scrap-invoices/schemas/scrap-invoice.schema';
import {
  BullionSale,
  BullionSaleSchema,
} from '../bullion-sales/schemas/bullion-sale.schema';
import {
  BullionPurchase,
  BullionPurchaseSchema,
} from '../bullion-purchases/schemas/bullion-purchase.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Invoice.name, schema: InvoiceSchema },
      { name: ScrapInvoice.name, schema: ScrapInvoiceSchema },
      { name: BullionSale.name, schema: BullionSaleSchema },
      { name: BullionPurchase.name, schema: BullionPurchaseSchema },
    ]),
  ],
  controllers: [DailyLedgerController],
  providers: [DailyLedgerService],
  exports: [DailyLedgerService],
})
export class DailyLedgerModule {}
