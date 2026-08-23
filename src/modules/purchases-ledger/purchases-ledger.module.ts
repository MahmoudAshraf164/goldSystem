import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PurchasesLedgerService } from './purchases-ledger.service';
import { PurchasesLedgerController } from './purchases-ledger.controller';
import { ExpensesModule } from '../expenses/expenses.module';
import {
  ScrapPurchase,
  ScrapPurchaseSchema,
} from '../scrap-purchases/schemas/scrap-purchases.schema'; // 👈 استيراد الموديل

@Module({
  imports: [
    ExpensesModule, // يقرأ المصاريف العامة
    MongooseModule.forFeature([
      { name: ScrapPurchase.name, schema: ScrapPurchaseSchema }, // 👈 تسجيل موديل شراء الكسر
    ]),
  ],
  controllers: [PurchasesLedgerController],
  providers: [PurchasesLedgerService],
})
export class PurchasesLedgerModule {}
