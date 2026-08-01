import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum BullionSaleStatus {
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Schema({ timestamps: true })
export class BullionSaleItem {
  @Prop({ type: Types.ObjectId, ref: 'BullionInventory', required: true })
  bullionItem: Types.ObjectId;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: Number, required: true })
  karat: number;

  @Prop({ type: Number, required: true })
  weightPerUnit: number;

  @Prop({ type: Number, required: true })
  quantity: number;

  @Prop({ type: Number, required: true })
  goldPricePerGram: number;

  @Prop({ type: Number, required: true })
  makingChargePerUnit: number;

  @Prop({ type: Number, required: true })
  itemTotalPrice: number;
}

export const BullionSaleItemSchema =
  SchemaFactory.createForClass(BullionSaleItem);

@Schema({ timestamps: true })
export class BullionSale extends Document {
  @Prop({ type: String, required: true, unique: true, index: true })
  invoiceNumber: string;

  // 👈 ربط الفاتورة بـ Customer Schema من موديول العملاء
  @Prop({ type: Types.ObjectId, ref: 'Customer', required: true, index: true })
  customer: Types.ObjectId;

  @Prop({ type: [BullionSaleItemSchema], required: true })
  items: BullionSaleItem[];

  @Prop({ type: Number, required: true })
  totalGoldWeight: number;

  @Prop({ type: Number, required: true })
  totalMakingCharges: number;

  @Prop({ type: Number, required: true })
  grandTotal: number;

  @Prop({ type: Number, required: true, default: 0 })
  paidAmount: number;

  @Prop({
    type: String,
    enum: BullionSaleStatus,
    default: BullionSaleStatus.COMPLETED,
    index: true,
  })
  status: BullionSaleStatus;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  seller: Types.ObjectId;
}

export const BullionSaleSchema = SchemaFactory.createForClass(BullionSale);
