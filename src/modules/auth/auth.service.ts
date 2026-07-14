import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Role } from '../../common/enums/role.enum';
import { generateOtp, getOtpExpiry } from '../../common/utils/otp.util';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  // ─── 1. تسجيل الدخول الأولي ───
  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException(
        'بيانات الاعتماد غير صحيحة أو الحساب غير نشط',
      );
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('بيانات الاعتماد غير صحيحة');
    }

    // الموظف يحصل على التوكن فوراً لتسهيل عمله اليومي
    if (user.role === Role.Employee) {
      const payload = { sub: user._id, email: user.email, role: user.role };
      return {
        requiresOtp: false,
        accessToken: this.jwtService.sign(payload),
        user: { id: user._id, fullName: user.fullName, role: user.role },
      };
    }

    // المالك يتم توليد وإرسال رمز OTP لحماية الجرد
    const otp = generateOtp();
    const expiry = getOtpExpiry(10); // 10 دقائق

    user.currentOtp = otp;
    user.otpExpiresAt = expiry;
    user.otpAttempts = 0;
    await user.save();

    await this.mailService.sendOtpEmail(user.email, otp);

    return {
      requiresOtp: true,
      message: 'تم إرسال رمز التحقق (OTP) إلى بريدك الإلكتروني بنجاح',
    };
  }

  // ─── 2. التحقق العام من الـ OTP (ل تسجيل الدخول أو نسيت كلمة المرور) ───
  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const user = await this.usersService.findByEmail(verifyOtpDto.email);

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('طلب غير مشروع');
    }

    if (
      !user.currentOtp ||
      !user.otpExpiresAt ||
      user.otpExpiresAt < new Date()
    ) {
      throw new BadRequestException(
        'رمز التحقق منتهي الصلاحية أو غير موجود، يرجى إعادة المحاولة',
      );
    }

    if (user.otpAttempts >= 3) {
      throw new BadRequestException(
        'لقد تجاوزت الحد الأقصى للمحاولات الخاطئة. يرجى البدء من جديد',
      );
    }

    if (user.currentOtp !== verifyOtpDto.otp) {
      user.otpAttempts += 1;
      await user.save();
      throw new BadRequestException(
        `رمز التحقق غير صحيح. المحاولات المتبقية: ${3 - user.otpAttempts}`,
      );
    }

    // ملحوظة أمنية: لا نقوم بتصفير الـ OTP هنا إذا كان لغرض الـ Reset Password،
    // بل نتركه ليتم التحقق منه كـ "تأكيد نهائي" في خطوة الحفظ الفعلي للباسورد.
    // لكن لو الشخص داخل Login عادي، بنصدر التوكن ونصفره فوراً:
    const payload = { sub: user._id, email: user.email, role: user.role };
    return {
      message: 'تم التحقق من الرمز بنجاح',
      accessToken: this.jwtService.sign(payload), // صالح لكل العمليات لاحقاً
      user: { id: user._id, fullName: user.fullName, role: user.role },
    };
  }

  // ─── 3. طلب نسيان كلمة المرور (إرسال OTP بدلاً من رابط) ───
  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(forgotPasswordDto.email);

    // حماية ضد الـ User Enumeration
    if (!user || user.status !== 'ACTIVE') {
      return {
        message:
          'إذا كان البريد الإلكتروني مسجلاً، فقد تم إرسال رمز التحقق بنجاح',
      };
    }

    // توليد OTP جديد خاص بطلب تعديل الباسورد وصالح لـ 10 دقائق
    const otp = generateOtp();
    const expiry = getOtpExpiry(10);

    user.currentOtp = otp;
    user.otpExpiresAt = expiry;
    user.otpAttempts = 0;
    await user.save();

    // إرسال الـ OTP عبر الـ MailService المخصصة والمستقلة
    await this.mailService.sendOtpEmail(user.email, otp);

    return {
      message:
        'إذا كان البريد الإلكتروني مسجلاً، فقد تم إرسال رمز التحقق بنجاح',
    };
  }

  // ─── 4. إعادة تعيين كلمة المرور الفعلية باستخدام الـ OTP والباسورد الجديد ───
  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(resetPasswordDto.email);

    if (!user || user.status !== 'ACTIVE') {
      throw new BadRequestException('طلب غير صالح');
    }

    // فحص أمان أخير للتأكد من صحة الـ OTP قبل الحفظ النهائي في الداتا بيز
    if (
      !user.currentOtp ||
      !user.otpExpiresAt ||
      user.otpExpiresAt < new Date()
    ) {
      throw new BadRequestException('رمز التحقق منتهي الصلاحية أو غير موجود');
    }

    if (user.currentOtp !== resetPasswordDto.otp) {
      throw new BadRequestException(
        'رمز التحقق غير صحيح، يرجى إعادة طلب الرمز',
      );
    }

    // تشفير الباسورد الجديد وحفظه وتصفير حقول الأمان بالكامل
    user.passwordHash = await bcrypt.hash(resetPasswordDto.newPassword, 10);
    user.currentOtp = undefined;
    user.otpExpiresAt = undefined;
    user.otpAttempts = 0;
    await user.save();

    return {
      message: 'تم إعادة تعيين كلمة المرور بنجاح، يمكنك تسجيل الدخول الآن',
    };
  }
}
