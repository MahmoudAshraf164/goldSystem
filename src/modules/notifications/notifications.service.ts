import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification } from './schemas/notification.schema';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<Notification>,
  ) {}

  // 1. لقط وحفظ حدث بيع الذهب الجديد
  @OnEvent('invoice.created')
  async handleInvoiceCreatedEvent(payload: any) {
    const { invoiceNumber, totalPrice, totalInvoiceNetWeight, soldBy } =
      payload;

    const message = `🚨 إشعار بيع جديد: تم إصدار الفاتورة رقم (${invoiceNumber}) بواسطة الموظف (${soldBy?.fullName || 'غير معروف'}). الوزن الصافي: ${totalInvoiceNetWeight} جرام، القيمة: ${totalPrice} جنيه.`;

    await this.saveAndLogNotification(message, 'NEW_GOLD_SALE');
  }

  // 2. لقط وحفظ حدث بيع الذهب الكسر
  @OnEvent('scrap-invoice.created')
  async handleScrapInvoiceCreatedEvent(payload: any) {
    const { invoiceNumber, totalPrice, weight, karat, actionBy } = payload;

    const message = `🚨 إشعار بيع كسر: تم إصدار فاتورة كسر رقم (${invoiceNumber}) عيار (${karat}) بواسطة (${actionBy?.fullName || 'غير معروف'}). الوزن: ${weight} جرام، المبلغ: ${totalPrice} جنيه.`;

    await this.saveAndLogNotification(message, 'SCRAP_GOLD_SALE');
  }

  // دالة الحفظ الموحدة في الداتا بيز
  private async saveAndLogNotification(message: string, type: string) {
    try {
      const newNotification = new this.notificationModel({ message, type });
      await newNotification.save();
      this.logger.log(`📱 تم حفظ وبث التنبيه الفوري بنجاح: ${message}`);
    } catch (error: unknown) {
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error('❌ فشل حفظ التنبيه في قاعدة البيانات', stack);
    }
  }

  // 3. جلب تاريخ السجل بالكامل للفرونت إند (الـ History)
  async getNotificationsHistory(): Promise<Notification[]> {
    return this.notificationModel
      .find()
      .sort({ createdAt: -1 }) // يعرض الأحدث فوق خالص دائماً
      .limit(100) // سقف لآخر 100 تنبيه لمنع ثقل الـ Request
      .exec();
  }
}
