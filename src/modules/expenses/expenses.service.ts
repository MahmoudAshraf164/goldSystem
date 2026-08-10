import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Expense } from './schemas/expense.schema';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { SafeService } from '../safe/safe.service'; // استيراد خدمة الخزنة الفورية

@Injectable()
export class ExpensesService {
  constructor(
    @InjectModel(Expense.name) private readonly expenseModel: Model<Expense>,
    private readonly safeService: SafeService, // 👈 حقن الخزنة هنا
  ) {}

  async createExpense(dto: CreateExpenseDto, userId: string): Promise<Expense> {
    const newExpense = new this.expenseModel({
      ...dto,
      actionBy: new Types.ObjectId(userId),
    });

    const savedExpense = await newExpense.save();

    // 🔥 تسميع الخزنة فوراً: خصم المصروف (OUTFLOW)
    await this.safeService.triggerTransaction(
      dto.amount,
      'OUTFLOW',
      `مصروف مخصوم: ${dto.title} [تصنيف: ${dto.category}]`,
      userId,
    );

    return savedExpense;
  }

  async findAll(category?: string): Promise<Expense[]> {
    const filter: any = {};
    if (category) {
      filter.category = category;
    }
    return this.expenseModel
      .find(filter)
      .populate('actionBy', 'fullName role')
      .sort({ createdAt: -1 })
      .exec();
  }
}
