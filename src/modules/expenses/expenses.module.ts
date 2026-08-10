import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ExpensesService } from './expenses.service';
import { ExpensesController } from './expenses.controller';
import { Expense, ExpenseSchema } from './schemas/expense.schema';
import { SafeModule } from '../safe/safe.module'; // استيراد الموديول الخاص بالخزنة الفورية

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Expense.name, schema: ExpenseSchema }]),
    SafeModule,
  ],
  controllers: [ExpensesController],
  providers: [ExpensesService],
  exports: [MongooseModule], // 👈 مهم جداً نعمل export عشان الـ PurchasesLedger يقدر يشوف الـ Schema دي
})
export class ExpensesModule {}
