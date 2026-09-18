import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class SupplierTransaction extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Supplier', required: true, index: true })
  supplierId: Types.ObjectId;

  @Prop({ required: true, enum: ['GOODS_RECEIVE', 'PAYMENT', 'ADJUSTMENT'] })
  type: string; // نوع الحركة: استلام بضاعة جديدة، أو سداد للمورد، أو تسوية

  // 1. البضاعة المستلمة من المورد (ذهب جديد / مشغولات)
  @Prop({
    type: [
      {
        karat: { type: Number, required: true },
        weight: { type: Number, required: true }, // الوزن القائم أو الصافي
        pricePerGram: { type: Number, required: true }, // سعر جرام الذهب يومها
        manufacturingFeePerGram: { type: Number, default: 0 }, // الأجر / المصنعية للجرام
        totalPrice: { type: Number, required: true }, // إجمالي السعر + المصنعية
      },
    ],
    default: [],
  })
  receivedItems: Array<{
    karat: number;
    weight: number;
    pricePerGram: number;
    manufacturingFeePerGram: number;
    totalPrice: number;
  }>;

  // 2. المدفوعات المقدمة للمورد (طريقة السداد: كسر أو كاش)
  @Prop({
    type: {
      cashPaid: { type: Number, default: 0 }, // الفلوس الكاش المدفوعة
      scrapPaid: [
        {
          karat: { type: Number, required: true },
          weight: { type: Number, required: true }, // وزن الذهب الكسر المسدد
          pricePerGram: { type: Number, required: true }, // سعر جرام الكسر يومها
          totalValue: { type: Number, required: true }, // قيمة الكسر الإجمالية
        },
      ],
      manufacturingFeePaid: { type: Number, default: 0 }, // أجر المصنعية المدفوع نقداً للمورد
    },
    default: { cashPaid: 0, scrapPaid: [], manufacturingFeePaid: 0 },
  })
  paymentDetails: {
    cashPaid: number;
    scrapPaid: Array<{
      karat: number;
      weight: number;
      pricePerGram: number;
      totalValue: number;
    }>;
    manufacturingFeePaid: number;
  };

  @Prop()
  notes: string; // ملاحظات (مثل رقم إيصال، تفاصيل الاتفاق)

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  actionBy: string; // المستخدم اللي عمل الحركة
}

export const SupplierTransactionSchema =
  SchemaFactory.createForClass(SupplierTransaction);
