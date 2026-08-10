import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Income, IncomeSchema } from './schemas/income.schema';
import { IncomeService } from './income.service';
import { IncomeController } from './income.controller';
import { DailyLedgerModule } from '../daily-ledger/daily-ledger.module';
import { SafeModule } from '../safe/safe.module'; // 👈 أضفنا استيراد موديول الخزنة هنا

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Income.name, schema: IncomeSchema }]),
    DailyLedgerModule, // استيراد موديول الدفتر المالي للتسميع الفوري
    SafeModule, // 👈 أضفنا SafeModule هنا عشان السيرفر يقدر يعمل Inject لـ SafeService بدون كراش
  ],
  controllers: [IncomeController],
  providers: [IncomeService],
  exports: [IncomeService],
})
export class IncomeModule {}
