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
        manufacturingFeePerGram: { type: Number, default: 0 },
        pricePerGram: { type: Number, default: 0 },
        totalPrice: { type: Number, default: 0 },
      },
    ],
    default: [],
  })
  receivedItems: Array<{
    karat: number;
    weight: number;
    manufacturingFeePerGram: number;
    pricePerGram?: number;
    totalPrice?: number;
  }>;

  @Prop({
    type: {
      manufacturingFeePaid: { type: Number, default: 0 },
      cashPaidForGold: { type: Number, default: 0 },
      goldPriceForCashDeduction: { type: Number, default: 0 },
      scrapPaid: [
        {
          karat: { type: Number, required: true },
          weight: { type: Number, required: true },
          pricePerGram: { type: Number, default: 0 },
          totalValue: { type: Number, default: 0 },
        },
      ],
    },
    default: {
      manufacturingFeePaid: 0,
      cashPaidForGold: 0,
      goldPriceForCashDeduction: 0,
      scrapPaid: [],
    },
  })
  paymentDetails: {
    manufacturingFeePaid: number;
    cashPaidForGold?: number;
    goldPriceForCashDeduction?: number;
    scrapPaid: Array<{
      karat: number;
      weight: number;
      pricePerGram?: number;
      totalValue?: number;
    }>;
  };

  @Prop()
  notes: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  actionBy: Types.ObjectId;
}

export const SupplierTransactionSchema =
  SchemaFactory.createForClass(SupplierTransaction);