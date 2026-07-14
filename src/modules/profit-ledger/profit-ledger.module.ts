import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProfitLedgerController } from './profit-ledger.controller';
import { ProfitLedgerService } from './profit-ledger.service';
import { Invoice, InvoiceSchema } from '../sales/schemas/invoice.schema';
import {
  ScrapInvoice,
  ScrapInvoiceSchema,
} from '../scrap-invoices/schemas/scrap-invoice.schema';
import { Expense, ExpenseSchema } from '../expenses/schemas/expense.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Invoice.name, schema: InvoiceSchema },
      { name: ScrapInvoice.name, schema: ScrapInvoiceSchema },
      { name: Expense.name, schema: ExpenseSchema },
    ]),
  ],
  controllers: [ProfitLedgerController],
  providers: [ProfitLedgerService],
  exports: [ProfitLedgerService],
})
export class ProfitLedgerModule {}
