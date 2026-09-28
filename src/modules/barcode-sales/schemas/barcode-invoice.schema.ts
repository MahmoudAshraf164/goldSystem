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

  @Prop({ required: true })
  weight: number;

  @Prop({ required: true })
  goldPricePerGram: number;

  @Prop({ required: true })
  goldTotalPrice: number;

  @Prop({ required: true, default: 0 })
  makingChargePerGram: number;

  @Prop({ required: true, default: 0 })
  totalMakingCharge: number;

  @Prop({ required: true })
  finalPrice: number;

  @Prop({ required: true })
  itemTotal: number;

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
      if (ret.createdBy) {
        ret.cashier = {
          _id: ret.createdBy._id || ret.createdBy,
          fullName:
            ret.createdBy.fullName || ret.createdBy.name || 'كاشير غير معرف',
        };
      } else {
        ret.cashier = { fullName: 'كاشير غير معرف' };
      }

      ret.totalAmount =
        typeof ret.finalPaidAmount === 'number' ? ret.finalPaidAmount : 0;

      ret.status = ret.isCancelled ? 'CANCELLED' : 'ACTIVE';

      return ret;
    },
  },
  toObject: { virtuals: true },
})
export class BarcodeInvoice {
  @Prop({ required: true, unique: true, index: true })
  invoiceNumber: string;

  @Prop({ type: [BarcodeInvoiceItemSchema], required: true })
  items: BarcodeInvoiceItem[];

  @Prop({ required: true, default: 0 })
  totalNetWeight: number;

  @Prop({ required: true, default: 0 })
  finalPaidAmount: number;

  @Prop({ required: true, default: 0 })
  totalAmount: number;

  @Prop({ type: Types.ObjectId, ref: 'Customer', required: true })
  customer: Types.ObjectId;

  @Prop({ required: false, default: '' })
  customerCountry?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ default: false })
  isCancelled: boolean;

  @Prop({ required: true, enum: ['ACTIVE', 'CANCELLED'], default: 'ACTIVE' })
  status: string;
}

export const BarcodeInvoiceSchema =
  SchemaFactory.createForClass(BarcodeInvoice);