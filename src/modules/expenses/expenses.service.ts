import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Expense } from './schemas/expense.schema';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { SafeService } from '../safe/safe.service';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectModel(Expense.name) private readonly expenseModel: Model<Expense>,
    private readonly safeService: SafeService,
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

  async findOne(id: string): Promise<Expense> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('معرف المصروف غير صالح');
    }
    const expense = await this.expenseModel.findById(id).populate('actionBy', 'fullName role').exec();
    if (!expense) {
      throw new NotFoundException('المصروف غير موجود');
    }
    return expense;
  }

  // ✏️ تعديل مصروف وتسوية الفرق في الخزنة
  async updateExpense(id: string, dto: UpdateExpenseDto, userId: string): Promise<Expense> {
    const expense = await this.findOne(id);
    const oldAmount = expense.amount;

    // تحديث البيانات
    Object.assign(expense, dto);
    if (dto.category) {
      expense.category = dto.category;
    }
    
    const updatedExpense = await expense.save();

    // تسوية الفرق في الخزنة إذا تغير المبلغ
    if (dto.amount !== undefined && dto.amount !== oldAmount) {
      const difference = dto.amount - oldAmount;
      if (difference > 0) {
        // تم زيادة قيمة المصروف -> خصم إضافي من الخزنة
        await this.safeService.triggerTransaction(
          difference,
          'OUTFLOW',
          `تعديل زيادة مصروف: ${updatedExpense.title} (الفرق: +${difference})`,
          userId,
        );
      } else {
        // تم تخفيض قيمة المصروف -> إعادة الفارق إلى الخزنة
        await this.safeService.triggerTransaction(
          Math.abs(difference),
          'INFLOW',
          `تعديل تخفيض مصروف: ${updatedExpense.title} (إعادة: ${Math.abs(difference)})`,
          userId,
        );
      }
    }

    return updatedExpense;
  }

  // 🗑️ حذف مصروف وإعادة المبلغ بالكامل للخزنة
  async deleteExpense(id: string, userId: string) {
    const expense = await this.findOne(id);

    await this.expenseModel.findByIdAndDelete(id);

    // إعادة قيمة المصروف المحذوف إلى الخزنة (INFLOW)
    await this.safeService.triggerTransaction(
      expense.amount,
      'INFLOW',
      `إلغاء/حذف مصروف: ${expense.title} (إعادة المبلغ للخزنة)`,
      userId,
    );

    return {
      success: true,
      message: 'تم حذف المصروف وإعادة المبلغ إلى الخزنة بنجاح',
      id,
    };
  }
}