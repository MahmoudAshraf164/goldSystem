import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  Min,
  IsNotEmpty,
} from 'class-validator';

export class CreateBarcodeItemDto {
  @IsOptional()
  @IsString()
  barcode?: string; // اختياري: إذا لم يرسل، السيستم يولد رمز فريد تلقائياً

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsNumber()
  @IsEnum([18, 21, 24])
  karat: number;

  @IsNumber()
  @Min(0.001)
  grossWeight: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tagWeight?: number;

  @IsNumber()
  @Min(0)
  makingChargePerGram: number;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  companyName?: string;
}
