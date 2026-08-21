import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BarcodeSaleItemDto {
  @IsString()
  barcode: string;

  @IsNumber()
  @Min(1)
  goldPricePerGram: number; // سعر الجرام المحدد لهذه القطعة

  @IsOptional()
  @IsNumber()
  @Min(0)
  makingChargePerGram?: number; // مصنعية الجرام (يمكن تعديلها يدوياً)

  @IsOptional()
  @IsNumber()
  @Min(0)
  customDiscount?: number; // خصم مخصص للقطعة إن وجد
}

export class CreateBarcodeInvoiceDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BarcodeSaleItemDto)
  items: BarcodeSaleItemDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number; // خصم على الفاتورة ككل

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;
}
