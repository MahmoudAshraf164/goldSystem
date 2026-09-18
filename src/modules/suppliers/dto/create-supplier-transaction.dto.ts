import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsArray,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ReceivedItemDto {
  @IsNumber() karat: number;
  @IsNumber() weight: number;
  @IsNumber() pricePerGram: number;
  @IsNumber() @IsOptional() manufacturingFeePerGram?: number;
  @IsNumber() totalPrice: number;
}

class ScrapPaidDto {
  @IsNumber() karat: number;
  @IsNumber() weight: number;
  @IsNumber() pricePerGram: number;
  @IsNumber() totalValue: number;
}

class PaymentDetailsDto {
  @IsNumber() @IsOptional() cashPaid?: number;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScrapPaidDto)
  @IsOptional()
  scrapPaid?: ScrapPaidDto[];
  @IsNumber() @IsOptional() manufacturingFeePaid?: number;
}

export class RecordSupplierTransactionDto {
  @IsString()
  @IsNotEmpty()
  supplierId: string;

  @IsString()
  @IsNotEmpty()
  type: string; // 'GOODS_RECEIVE' | 'PAYMENT'

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
