import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) public readonly userModel: Model<User>) {}

  // إيجاد مستخدم بالإيميل
  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email: email.toLowerCase().trim() }).exec();
  }

  // إيجاد مستخدم بالـ ID (بشرط ألا يكون حسابه مؤرشفاً في الحذف الناعم)
  async findById(id: string): Promise<User> {
    const user = await this.userModel
      .findOne({ _id: id, status: { $ne: 'ARCHIVED' } })
      .exec();
    if (!user) {
      throw new NotFoundException('المستخدم غير موجود أو تم نقله للأرشيف');
    }
    return user;
  }

  // إنشاء مستخدم جديد (للموظفين - بحد أقصى موظفين فقط)
  async create(createUserDto: CreateUserDto): Promise<User> {
    const { email, password, ...rest } = createUserDto;

    // 1. التحقق من الحد الأقصى للموظفين النشطين (Max 5 Employees)
    const activeEmployeesCount = await this.userModel.countDocuments({
      role: Role.Employee,
      status: 'ACTIVE',
    });

    if (activeEmployeesCount >= 5) {
      throw new BadRequestException(
        'عذراً، تم الوصول للحد الأقصى المسموح به للموظفين في النظام (موظفين فقط)',
      );
    }

    // 2. التحقق من عدم تكرار الإيميل
    const existingUser = await this.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('البريد الإلكتروني مسجل بالفعل في النظام');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = new this.userModel({
      ...rest,
      email: email.toLowerCase().trim(),
      passwordHash,
      role: Role.Employee, // إجبار الدور ليكون موظف
      status: 'ACTIVE',
    });

    return newUser.save();
  }

  // تعديل بيانات موظف أو المالك نفسه (مع إمكانية تعديل كلمة المرور لو أُرسلت)// تعديل بيانات موظف أو المالك نفسه (مع حماية قفل الحد الأقصى للموظفين النشطين)
  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const { password, status, ...rest } = updateUserDto as any;
    const updateData: any = { ...rest };

    // 1. جلب بيانات المستخدم الحالية قبل التعديل لمعرفة حالته السابقة ودوره
    const currentUser = await this.userModel.findById(id).exec();
    if (!currentUser) {
      throw new NotFoundException('المستخدم غير موجود');
    }

    // 2. إذا كان المستخدم موظفاً وتم إرسال حالة ACTIVE جديدة، وهو في الأصل لم يكن ACTIVE (كان ARCHIVED أو INACTIVE)
    if (
      currentUser.role === Role.Employee &&
      status === 'ACTIVE' &&
      currentUser.status !== 'ACTIVE'
    ) {
      // نعد الموظفين النشطين حالياً في المحل (باستثناء الموظف الحالي نفسه لو كان بيعدل)
      const activeEmployeesCount = await this.userModel.countDocuments({
        role: Role.Employee,
        status: 'ACTIVE',
        _id: { $ne: id }, // استثناء الموظف الحالي من العد
      });

      // شرط الإصدار 1.0 (الحد الأقصى موظف واحد نشط فقط)
      if (activeEmployeesCount >= 5) {
        throw new BadRequestException(
          'عذراً، لا يمكن تفعيل هذا الموظف. يوجد بالفعل 5 موظفين نشطين في النظام، والحد الأقصى هو 5 موظفين فقط.',
        );
      }
    }

    // إذا مر من الفحص أو لم يكن هناك تغيير في الحالة، نعتمد الحالة الجديدة
    if (status) {
      updateData.status = status;
    }

    // لو المالك أرسل كلمة مرور جديدة يتم تشفيرها
    if (password && password.trim() !== '') {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();

    if (!updatedUser) {
      throw new NotFoundException('المستخدم غير موجود');
    }

    return updatedUser;
  }

  // جلب الموظفين بناءً على الحالة النشطة أو المؤرشفة
  async findAllEmployees(status: string = 'ACTIVE'): Promise<User[]> {
    const queryStatus =
      status.toUpperCase() === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE';
    return this.userModel
      .find({ role: Role.Employee, status: queryStatus })
      .sort({ createdAt: -1 })
      .exec();
  }

  // الحذف الناعم للموظف (تحويل حالته للأرشيف لحماية سجلات البيع القديمة الخاصة به)
  async softDeleteEmployee(id: string): Promise<void> {
    const result = await this.userModel.updateOne(
      { _id: id, role: Role.Employee },
      { status: 'ARCHIVED' },
    );

    if (result.matchedCount === 0) {
      throw new NotFoundException('الموظف غير موجود أو ليس موظفاً ليتم أرشفته');
    }
  }
}
