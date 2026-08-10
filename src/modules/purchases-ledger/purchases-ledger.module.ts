import { Module } from '@nestjs/common';
import { PurchasesLedgerService } from './purchases-ledger.service';
import { PurchasesLedgerController } from './purchases-ledger.controller';
import { ExpensesModule } from '../expenses/expenses.module';

@Module({
  imports: [ExpensesModule], // يقراء مباشرة من موديول المصاريف
  controllers: [PurchasesLedgerController],
  providers: [PurchasesLedgerService],
})
export class PurchasesLedgerModule {}
