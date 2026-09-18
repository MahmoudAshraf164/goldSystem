import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PurchasesLedgerService } from './purchases-ledger.service';
import { PurchasesLedgerController } from './purchases-ledger.controller';
import { ExpensesModule } from '../expenses/expenses.module';
import {
  ScrapPurchase,
  ScrapPurchaseSchema,
} from '../scrap-purchases/schemas/scrap-purchases.schema';
import {
  SupplierTransaction,
  SupplierTransactionSchema,
} from '../suppliers/schemas/supplier-transaction.schema';

@Module({
  imports: [
    ExpensesModule,
    MongooseModule.forFeature([
      { name: ScrapPurchase.name, schema: ScrapPurchaseSchema },
      { name: SupplierTransaction.name, schema: SupplierTransactionSchema },
    ]),
  ],
  controllers: [PurchasesLedgerController],
  providers: [PurchasesLedgerService],
})
export class PurchasesLedgerModule {}
