import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: this.configService.get<string>('EMAIL_USER'),
        pass: this.configService.get<string>('EMAIL_PASS'),
      },
    });
  }

  async sendOtpEmail(to: string, otp: string): Promise<void> {
    const mailOptions = {
      from: `"نظام إدارة الذهب" <${this.configService.get<string>('EMAIL_USER')}>`,
      to,
      subject: 'رمز التحقق الثنائي لنظام GMS',
      html: `
        <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
          <h2 style="color: #C9A84C;">نظام إدارة الذهب (GMS)</h2>
          <p>مرحباً بك، لقد قمت بطلب تسجيل الدخول لحساب المالك.</p>
          <p>رمز التحقق الخاص بك هو:</p>
          <div style="background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #111; border-radius: 4px; border: 1px dashed #C9A84C;">
            ${otp}
          </div>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">هذا الرمز صالح لمدة 10 دقائق فقط. يرجى عدم مشاركته مع أي شخص.</p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('❌ Failed to send OTP email:', error);
      throw new BadRequestException(
        'فشل في إرسال البريد الإلكتروني الخاص برمز التحقق',
      );
    }
  }
}
