import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DailyLedgerService } from './daily-ledger.service';
import { DailyLedgerController } from './daily-ledger.controller';
import { Invoice, InvoiceSchema } from '../sales/schemas/invoice.schema';
import {
  ScrapInvoice,
  ScrapInvoiceSchema,
} from '../scrap-invoices/schemas/scrap-invoice.schema';
import { Income, IncomeSchema } from '../income/schemas/income.schema';
import { Expense, ExpenseSchema } from '../expenses/schemas/expense.schema';
import {
  BullionSale,
  BullionSaleSchema,
} from '../bullion-sales/schemas/bullion-sale.schema'; // 👈 استيراد موديل السبايك

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Invoice.name, schema: InvoiceSchema },
      { name: ScrapInvoice.name, schema: ScrapInvoiceSchema },
      { name: Income.name, schema: IncomeSchema },
      { name: Expense.name, schema: ExpenseSchema },
      { name: BullionSale.name, schema: BullionSaleSchema }, // 👈 تسجيل الموديل هنا
    ]),
  ],
  controllers: [DailyLedgerController],
  providers: [DailyLedgerService],
  exports: [DailyLedgerService],
})
export class DailyLedgerModule {}
