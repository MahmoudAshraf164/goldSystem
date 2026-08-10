import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Income } from './schemas/income.schema';
import { CreateIncomeDto } from './dto/create-income.dto';
import { SafeService } from '../safe/safe.service'; // 👈 استيراد خدمة الخزنة

@Injectable()
export class IncomeService {
  constructor(
    @InjectModel(Income.name) private readonly incomeModel: Model<Income>,
    private readonly safeService: SafeService, // 👈 حقن خدمة الخزنة
  ) {}

  async createIncome(dto: CreateIncomeDto, userId: string): Promise<Income> {
    const newIncome = new this.incomeModel({
      ...dto,
      actionBy: new Types.ObjectId(userId),
    });

    const savedIncome = await newIncome.save();

    // 🔥 تسميع الخزنة فوراً: إضافة نقدية (INFLOW)
    await this.safeService.triggerTransaction(
      dto.amount,
      'INFLOW',
      `إيداع نقدية إضافية بالدرج: ${dto.reason}`,
      userId,
    );

    return savedIncome;
  }

  async findAll(): Promise<Income[]> {
    return this.incomeModel
      .find()
      .populate('actionBy', 'fullName role')
      .sort({ createdAt: -1 })
      .exec();
  }
}
