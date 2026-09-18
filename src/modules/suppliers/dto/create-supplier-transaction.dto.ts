import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsArray,
  IsOptional,
  ValidateNested,
  IsMongoId,
  IsIn,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class ReceivedItemDto {
  @IsNumber() karat: number;
  @IsNumber() weight: number;
  @IsNumber() pricePerGram: number;
  @IsNumber() @IsOptional() manufacturingFeePerGram?: number;
  @IsNumber() totalPrice: number;
}

export class ScrapPaidDto {
  @IsNumber() karat: number;
  @IsNumber() weight: number;
  @IsNumber() pricePerGram: number;
  @IsNumber() totalValue: number;
}

export class PaymentDetailsDto {
  @IsNumber() @IsOptional() cashPaid?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScrapPaidDto)
  @IsOptional()
  scrapPaid?: ScrapPaidDto[];

  @IsNumber() @IsOptional() manufacturingFeePaid?: number;
}

export class RecordSupplierTransactionDto {
  // 🟢 حماية الـ MongoId من النصوص الفارغة
  @IsMongoId({ message: 'معرف المورد غير صالح' })
  @IsNotEmpty()
  @Transform(({ value }) => (value === '' ? undefined : value))
  supplierId: string;

  @IsString()
  @IsIn(['GOODS_RECEIVE', 'PAYMENT', 'ADJUSTMENT'])
  type: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceivedItemDto)
  @IsOptional()
  receivedItems?: ReceivedItemDto[];

  @ValidateNested()
  @Type(() => PaymentDetailsDto)
  @IsOptional()
  paymentDetails?: PaymentDetailsDto;

  @IsString()
  @IsOptional()
  notes?: string;
}
