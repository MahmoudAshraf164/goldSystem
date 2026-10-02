import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
  ArrayMinSize,
  IsNotEmpty,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
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
  @Transform(({ value }) =>
    typeof value === 'number' ? Number(value.toFixed(2)) : value,
  )
  goldPricePerGram: number;

  @ApiPropertyOptional({
    description: 'وزن القطعة (يرسله الفرونت إند من الشاشة)',
    example: 2.37,
  })
  @IsOptional()
  @IsNumber()
  weight?: number;

  @ApiPropertyOptional({
    description: 'مصنعية الجرام للقطعة (تُقرّب تلقائياً لأقرب خانتين عشريتين)',
    example: 180.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) =>
    typeof value === 'number' ? Number(value.toFixed(2)) : value,
  )
  makingChargePerGram?: number;

  @ApiPropertyOptional({
    description: 'إجمالي سعر القطعة النهائي بعد التعديل اليدوي (اختياري)',
    example: 76400.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) =>
    typeof value === 'number' ? Number(value.toFixed(2)) : value,
  )
  finalPrice?: number;
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

  @ApiProperty({
    description: 'اسم العميل المباشر (إجباري)',
    example: 'أحمد محمود',
  })
  @IsString({ message: 'اسم العميل يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'اسم العميل مطلوب ولا يمكن أن يكون فارغاً' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  customerName: string;

  @ApiPropertyOptional({
    description: 'معرف العميل (ObjectId) المربوط بالفاتورة (اختياري)',
    example: '60d5ecb8b5c9c22b4c8b9999',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === '' ? undefined : value))
  customerId?: string;

  @ApiPropertyOptional({
    description: 'رقم هاتف العميل (اختياري)',
    example: '01012345678',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    value === '' || value === null
      ? undefined
      : typeof value === 'string'
        ? value.trim()
        : value,
  )
  phoneNumber?: string;

  @ApiPropertyOptional({
    description: 'بلد / جنسية العميل (اختياري)',
    example: 'مصر',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    value === '' || value === null
      ? undefined
      : typeof value === 'string'
        ? value.trim()
        : value,
  )
  country?: string;
}
