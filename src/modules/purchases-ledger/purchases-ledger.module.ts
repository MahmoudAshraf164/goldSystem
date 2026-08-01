import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PurchasesLedgerService } from './purchases-ledger.service';
import { PurchasesLedgerController } from './purchases-ledger.controller';
import { ExpensesModule } from '../expenses/expenses.module';
import {
  ScrapInvoice,
  ScrapInvoiceSchema,
} from '../scrap-invoices/schemas/scrap-invoice.schema';
import {
  BullionPurchase,
  BullionPurchaseSchema,
} from '../bullion-purchases/schemas/bullion-purchase.schema';

@Module({
  imports: [
    ExpensesModule,
    MongooseModule.forFeature([
      { name: ScrapInvoice.name, schema: ScrapInvoiceSchema },
      { name: BullionPurchase.name, schema: BullionPurchaseSchema },
    ]),
  ],
  controllers: [PurchasesLedgerController],
  providers: [PurchasesLedgerService],
  exports: [PurchasesLedgerService],
})
export class PurchasesLedgerModule {}
