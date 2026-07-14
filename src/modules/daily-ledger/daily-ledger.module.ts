import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DailyLedgerService } from './daily-ledger.service';
import { DailyLedgerController } from './daily-ledger.controller';
import { Invoice, InvoiceSchema } from '../sales/schemas/invoice.schema';
import {
  ScrapInvoice,
  ScrapInvoiceSchema,
} from '../scrap-invoices/schemas/scrap-invoice.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Invoice.name, schema: InvoiceSchema },
      { name: ScrapInvoice.name, schema: ScrapInvoiceSchema },
    ]),
  ],
  controllers: [DailyLedgerController],
  providers: [DailyLedgerService],
})
export class DailyLedgerModule {}
