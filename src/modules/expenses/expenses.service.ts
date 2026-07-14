import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Expense } from './schemas/expense.schema';
import { CreateExpenseDto } from './dto/create-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectModel(Expense.name) private readonly expenseModel: Model<Expense>,
  ) {}

  // تسجيل حظر مالي جديد (خروج كاش)
  async createExpense(dto: CreateExpenseDto, userId: string): Promise<Expense> {
    const newExpense = new this.expenseModel({
      ...dto,
      actionBy: new Types.ObjectId(userId),
    });
    return newExpense.save();
  }

  // جلب كل المصاريف مع دعم الفلترة الذكية (Category Filtration) لمراجعة الأونر
  async findAll(category?: string): Promise<Expense[]> {
    const filter: any = {};

    // 🛠️ لو تم إرسال تصنيف معين، نقوم بإضافته لشرط البحث فوراً
    if (category) {
      filter.category = category;
    }

    return this.expenseModel
      .find(filter)
      .populate('actionBy', 'fullName role')
      .sort({ createdAt: -1 }) // من الأحدث للأقدم دائماً ليظهر الشاي الجديد والمشتروات فوق
      .exec();
  }
}
