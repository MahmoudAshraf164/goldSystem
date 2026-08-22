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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BarcodeSaleItemDto {
  @ApiProperty({
    description: 'رمز الباركود الخاص بالقطعة المراد بيعها',
    example: '20261001001',
  })
  @IsString()
  barcode: string;

  @ApiProperty({
    description: 'سعر جرام الذهب المحدد للقطعة وقت عملية البيع',
    example: 3250.5,
  })
  @IsNumber()
  @Min(1)
  goldPricePerGram: number;

  @ApiPropertyOptional({
    description:
      'مصنعية الجرام للقطعة (اختياري: إن لم تُرسل تُحسب المصنعية المسجلة بالقطعة في المخزن)',
    example: 180.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  makingChargePerGram?: number;
}

export class CreateBarcodeInvoiceDto {
  @ApiProperty({
    description:
      'قائمة القطع المباعة بالفاتورة (يجب إرسال قطعة واحدة على الأقل)',
    type: [BarcodeSaleItemDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BarcodeSaleItemDto)
  items: BarcodeSaleItemDto[];

  @ApiPropertyOptional({
    description: 'معرف العميل (ObjectId) المربوط بالفاتورة (اختياري)',
    example: '60d5ecb8b5c9c22b4c8b9999',
  })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({
    description:
      'اسم العميل المباشر للإنشاء التلقائي (اختياري في حال عدم تحديد customerId)',
    example: 'أحمد محمود',
  })
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiPropertyOptional({
    description: 'رقم هاتف العميل المباشر (اختياري)',
    example: '01012345678',
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;
}
