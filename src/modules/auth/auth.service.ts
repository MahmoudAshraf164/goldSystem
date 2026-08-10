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
import { generateOtp, getOtpExpiry } from '../../common/utils/otp.util'; // 👈 تم تصحيح المسار هنا
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  // ─── 1. تسجيل الدخول المباشر لجميع الأدوار (المالك والموظف) ───
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

    // 🚀 الجميع (مالك وموظف) يحصل على التوكن فوراً بدون OTP
    const payload = { sub: user._id, email: user.email, role: user.role };
    return {
      requiresOtp: false,
      accessToken: this.jwtService.sign(payload),
      user: { id: user._id, fullName: user.fullName, role: user.role },
    };
  }

  // ─── 2. التحقق من الـ OTP (لدعم شاشة نسيت كلمة المرور) ───
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

    const payload = { sub: user._id, email: user.email, role: user.role };
    return {
      message: 'تم التحقق من الرمز بنجاح',
      accessToken: this.jwtService.sign(payload),
      user: { id: user._id, fullName: user.fullName, role: user.role },
    };
  }

  // ─── 3. طلب نسيان كلمة المرور (إرسال OTP للإيميل) ───
  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(forgotPasswordDto.email);

    if (!user || user.status !== 'ACTIVE') {
      return {
        message:
          'إذا كان البريد الإلكتروني مسجلاً، فقد تم إرسال رمز التحقق بنجاح',
      };
    }

    // توليد الـ OTP للمالك أو الموظف لاسترجاع الحساب
    const otp = generateOtp();
    const expiry = getOtpExpiry(10); // 10 دقائق

    user.currentOtp = otp;
    user.otpExpiresAt = expiry;
    user.otpAttempts = 0;
    await user.save();

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
