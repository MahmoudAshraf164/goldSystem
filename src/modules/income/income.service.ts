import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Income } from './schemas/income.schema';
import { CreateIncomeDto } from './dto/create-income.dto';
import { UpdateIncomeDto } from './dto/update-income.dto';
import { SafeService } from '../safe/safe.service';

@Injectable()
export class IncomeService {
  constructor(
    @InjectModel(Income.name) private readonly incomeModel: Model<Income>,
    private readonly safeService: SafeService,
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
      `إيداع نقدية إضافية بالدرج: ${dto.reason || 'إيراد جديد'}`,
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

  async findOne(id: string): Promise<Income> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('معرف الإيراد غير صالح');
    }
    const income = await this.incomeModel
      .findById(id)
      .populate('actionBy', 'fullName role')
      .exec();

    if (!income) {
      throw new NotFoundException('الإيراد غير موجود');
    }
    return income;
  }

  // ✏️ تعديل إيراد وتسوية الفارق في الخزنة تلقائياً
  async updateIncome(
    id: string,
    dto: UpdateIncomeDto,
    userId: string,
  ): Promise<Income> {
    const income = await this.findOne(id);
    const oldAmount = income.amount;

    // تحديث البيانات
    Object.assign(income, dto);
    const updatedIncome = await income.save();

    // تسوية الفارق في الخزنة إذا تغير المبلغ
    if (dto.amount !== undefined && dto.amount !== oldAmount) {
      const difference = dto.amount - oldAmount;
      if (difference > 0) {
        // تم زيادة مبلغ الإيراد -> إضافة الفارق للخزنة (INFLOW)
        await this.safeService.triggerTransaction(
          difference,
          'INFLOW',
          `تعديل زيادة إيراد: ${updatedIncome.reason || ''} (إضافة فارق: +${difference})`,
          userId,
        );
      } else {
        // تم تخفيض مبلغ الإيراد -> خصم الفارق من الخزنة (OUTFLOW)
        await this.safeService.triggerTransaction(
          Math.abs(difference),
          'OUTFLOW',
          `تعديل تخفيض إيراد: ${updatedIncome.reason || ''} (خصم فارق: -${Math.abs(difference)})`,
          userId,
        );
      }
    }

    return updatedIncome;
  }

  // 🗑️ حذف إيراد وإلغاء قيمته من الخزنة (خصم المبلغ)
  async deleteIncome(id: string, userId: string) {
    const income = await this.findOne(id);

    await this.incomeModel.findByIdAndDelete(id);

    // إلغاء الإيراد المحذوف عن طريق خصم قيمته من الخزنة (OUTFLOW)
    await this.safeService.triggerTransaction(
      income.amount,
      'OUTFLOW',
      `إلغاء/حذف إيراد: ${income.reason || ''} (خصم المبلغ الملغى من الخزنة)`,
      userId,
    );

    return {
      success: true,
      message: 'تم حذف الإيراد وخصم قيمته من الخزنة بنجاح',
      id,
    };
  }
}