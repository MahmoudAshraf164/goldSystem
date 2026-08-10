import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Safe } from './schemas/safe.schema';
import {
  UpdateSafeBalanceDto,
  SetupSafePasswordDto,
  ResetSafeDto,
} from './dto/safe-control.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SafeService implements OnModuleInit {
  constructor(
    @InjectModel(Safe.name) private readonly safeModel: Model<Safe>,
  ) {}

  async onModuleInit() {
    const safeCount = await this.safeModel.countDocuments();
    if (safeCount === 0) {
      const initialSafe = new this.safeModel({
        balance: 0,
        safePassword: null,
        lastUpdatedAction: {
          actionType: 'MANUAL_ADJUSTMENT',
          amount: 0,
          reason: 'تهيئة الخزنة الافتراضية للمحل بنجاح',
          timestamp: new Date(),
        },
      });
      await initialSafe.save();
    }
  }

  // ميثود مركزية لتحديث الخزنة (تغنيك عن تكرار الكود وتصلح خطأ الـ Schema)
  private async updateSafeState(
    safe: Safe,
    amount: number,
    actionType: string,
    reason: string,
    userId?: string | Types.ObjectId,
  ) {
    safe.balance = parseFloat((safe.balance + amount).toFixed(2));

    // الحل هنا: إضافة actionBy بشكل اختياري
    const actionObj: any = {
      actionType,
      amount: Math.abs(amount),
      reason,
      timestamp: new Date(),
    };

    if (userId) {
      actionObj.actionBy =
        typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    }

    safe.lastUpdatedAction = actionObj;
    await safe.save();
  }

  private async getSafeInstance(): Promise<Safe> {
    const safe = await this.safeModel.findOne();
    if (!safe) {
      throw new BadRequestException('الخزنة غير مهيأة بالنظام');
    }
    return safe;
  }

  async getSafeStatus(): Promise<Safe> {
    return this.getSafeInstance();
  }

  async setupSafePassword(dto: SetupSafePasswordDto) {
    const safe = await this.getSafeInstance();
    if (safe.safePassword) {
      if (!dto.currentSafePassword)
        throw new BadRequestException('يجب إدخال الباسورد الحالي');
      const isMatch = await bcrypt.compare(
        dto.currentSafePassword,
        safe.safePassword,
      );
      if (!isMatch) throw new UnauthorizedException('الباسورد الحالي غير صحيح');
    }
    const salt = await bcrypt.genSalt(10);
    safe.safePassword = await bcrypt.hash(dto.newSafePassword, salt);
    await safe.save();
    return { success: true, message: 'تم تعيين باسورد الخزنة بنجاح' };
  }

  async updateBalanceManually(
    dto: UpdateSafeBalanceDto,
    userId: string,
  ): Promise<Safe> {
    const safe = await this.getSafeInstance();
    if (!safe.safePassword)
      throw new BadRequestException('برجاء إعداد باسورد الخزنة أولاً');

    const isMatch = await bcrypt.compare(dto.safePassword, safe.safePassword);
    if (!isMatch) throw new UnauthorizedException('الباسورد غير صحيح');

    const diff = dto.newBalance - safe.balance;
    await this.updateSafeState(
      safe,
      diff,
      'MANUAL_ADJUSTMENT',
      dto.reason,
      userId,
    );
    return safe;
  }

  async resetSafe(dto: ResetSafeDto, userId: string): Promise<Safe> {
    const safe = await this.getSafeInstance();
    if (!safe.safePassword)
      throw new BadRequestException('برجاء إعداد باسورد الخزنة أولاً');

    const isMatch = await bcrypt.compare(dto.safePassword, safe.safePassword);
    if (!isMatch) throw new UnauthorizedException('الباسورد غير صحيح');

    await this.updateSafeState(
      safe,
      -safe.balance,
      'RESET',
      'تصفير كامل للدرج وبدء دورة مالية جديدة',
      userId,
    );
    return safe;
  }

  // تستخدم للعمليات التلقائية (بدون باسورد - مثل فواتير السبايك)
  async updateSafeBalanceAutomatically(
    amount: number,
    actionType: string,
    reason: string,
  ) {
    const safe = await this.getSafeInstance();
    // استدعاء الميثود المركزية (بدون userId)
    await this.updateSafeState(safe, amount, actionType, reason);
  }

  // ميثود العمليات العامة (تحتاج userId)
  async triggerTransaction(
    amount: number,
    type: 'INFLOW' | 'OUTFLOW',
    reason: string,
    userId: string,
  ): Promise<void> {
    const safe = await this.getSafeInstance();
    const finalAmount = type === 'INFLOW' ? amount : -amount;
    await this.updateSafeState(safe, finalAmount, type, reason, userId);
  }
}
