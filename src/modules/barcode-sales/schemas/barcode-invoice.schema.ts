import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BarcodeInvoiceDocument = BarcodeInvoice & Document;

@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class BarcodeInvoiceItem {
  @Prop({ type: Types.ObjectId, ref: 'BarcodeInventory', required: true })
  item: Types.ObjectId;

  @Prop({ required: true })
  barcode: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true, enum: [18, 21, 24] })
  karat: number;

  @Prop({ required: true })
  netWeight: number;

  // 🟢 الوزن
  @Prop({ required: true })
  weight: number;

  @Prop({ required: true })
  goldPricePerGram: number; // سعر جرام الذهب وقت البيع

  @Prop({ required: true })
  goldTotalPrice: number; // سعر الذهب الصافي = الوزن الصافي × سعر الجرام

  @Prop({ required: true, default: 0 })
  makingChargePerGram: number; // مصنعية الجرام

  @Prop({ required: true, default: 0 })
  totalMakingCharge: number; // إجمالي المصنعية للقطعة

  @Prop({ required: true })
  finalPrice: number; // إجمالي سعر القطعة = الذهب + المصنعية

  // 🟢 إجمالي القطعة
  @Prop({ required: true })
  itemTotal: number;

  // 🖼️ إضافة صور القطعة للعرض في الواجهة (للعناصر التي اشتراها الزبون فقط)
  @Prop({ type: [String], default: [] })
  images?: string[];
}

export const BarcodeInvoiceItemSchema =
  SchemaFactory.createForClass(BarcodeInvoiceItem);

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc: any, ret: any) => {
      // 🟢 معالجة وتوحيد بيانات الكاشير لشاشات الطباعة
      if (ret.createdBy) {
        ret.cashier = {
          _id: ret.createdBy._id || ret.createdBy,
          fullName:
            ret.createdBy.fullName || ret.createdBy.name || 'كاشير غير معرف',
        };
      } else {
        ret.cashier = { fullName: 'كاشير غير معرف' };
      }

      // 🟢 حساب totalAmount دائماً وإرجاعه كرقم
      ret.totalAmount =
        typeof ret.finalPaidAmount === 'number' ? ret.finalPaidAmount : 0;

      // 🟢 توحيد حالة الفاتورة
      ret.status = ret.isCancelled ? 'CANCELLED' : 'ACTIVE';

      return ret;
    },
  },
  toObject: { virtuals: true },
})
export class BarcodeInvoice {
  @Prop({ required: true, unique: true, index: true })
  invoiceNumber: string; // رقم الفاتورة التلقائي مثل: POS-20260821-0001

  @Prop({ type: [BarcodeInvoiceItemSchema], required: true })
  items: BarcodeInvoiceItem[];

  @Prop({ required: true, default: 0 })
  totalNetWeight: number; // إجمالي الوزن الصافي المباع

  @Prop({ required: true, default: 0 })
  finalPaidAmount: number; // إجمالي المبلغ المطلوب والمدفوع كاملاً

  @Prop({ required: true, default: 0 })
  totalAmount: number; // الإجمالي الكلي للفاتورة

  @Prop({ type: Types.ObjectId, ref: 'Customer', required: false })
  customer?: Types.ObjectId; // العميل (اختياري)

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId; // الموظف البائع / الكاشير

  @Prop({ default: false })
  isCancelled: boolean; // هل الفاتورة ملغاة

  @Prop({ required: true, enum: ['ACTIVE', 'CANCELLED'], default: 'ACTIVE' })
  status: string; // حالة الفاتورة
}

export const BarcodeInvoiceSchema =
  SchemaFactory.createForClass(BarcodeInvoice);
