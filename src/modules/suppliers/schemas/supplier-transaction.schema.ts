import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class SupplierTransaction extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Supplier', required: true, index: true })
  supplierId: Types.ObjectId;

  @Prop({ required: true, enum: ['GOODS_RECEIVE', 'PAYMENT', 'ADJUSTMENT'] })
  type: string;

  @Prop({
    type: [
      {
        karat: { type: Number, required: true },
        weight: { type: Number, required: true },
        pricePerGram: { type: Number, required: true },
        manufacturingFeePerGram: { type: Number, default: 0 },
        totalPrice: { type: Number, required: true },
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

  @Prop({
    type: {
      cashPaid: { type: Number, default: 0 },
      scrapPaid: [
        {
          karat: { type: Number, required: true },
          weight: { type: Number, required: true },
          pricePerGram: { type: Number, required: true },
          totalValue: { type: Number, required: true },
        },
      ],
      manufacturingFeePaid: { type: Number, default: 0 },
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
  notes: string;

  // 🟢 تعديل النوع هنا ليكون Types.ObjectId متوافق مع المونجو
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  actionBy: Types.ObjectId;
}

export const SupplierTransactionSchema =
  SchemaFactory.createForClass(SupplierTransaction);
