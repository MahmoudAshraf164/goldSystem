import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({ example: 21, description: 'عيار الذهب المستلم (18, 21, 24)' })
  @IsNumber()
  karat: number;

  @ApiProperty({ example: 500, description: 'الوزن المستلم بالجرام' })
  @IsNumber()
  weight: number;

  @ApiPropertyOptional({
    example: 150,
    description: 'مصنعية/أجر الجرام الواحد بالجنيه',
    default: 0,
  })
  @IsNumber()
  @IsOptional()
  manufacturingFeePerGram?: number;

  @ApiPropertyOptional({
    example: 3800,
    description: 'سعر الجرام (اختياري - فقط لو فيه تقييم مالي للبضاعة)',
  })
  @IsNumber()
  @IsOptional()
  pricePerGram?: number;

  @ApiPropertyOptional({
    example: 1900000,
    description: 'إجمالي قيمة الذهب (اختياري)',
  })
  @IsNumber()
  @IsOptional()
  totalPrice?: number;
}

export class ScrapPaidDto {
  @ApiProperty({ example: 21, description: 'عيار الذهب الكسر المسدد' })
  @IsNumber()
  karat: number;

  @ApiProperty({ example: 300, description: 'وزن الذهب الكسر المسدد بالجرام' })
  @IsNumber()
  weight: number;

  @ApiPropertyOptional({ example: 3750, description: 'سعر جرام الكسر (اختياري)' })
  @IsNumber()
  @IsOptional()
  pricePerGram?: number;

  @ApiPropertyOptional({
    example: 1125000,
    description: 'إجمالي قيمة الكسر (اختياري)',
  })
  @IsNumber()
  @IsOptional()
  totalValue?: number;
}

export class PaymentDetailsDto {
  @ApiPropertyOptional({
    example: 75000,
    description: 'المبلغ المدفوع حسام مصنعية/أجر نقداً من الخزنة',
    default: 0,
  })
  @IsNumber()
  @IsOptional()
  manufacturingFeePaid?: number;

  @ApiPropertyOptional({
    type: [ScrapPaidDto],
    description: 'تفاصيل الذهب الكسر المسدد للمورد (وزن وعيار)',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScrapPaidDto)
  @IsOptional()
  scrapPaid?: ScrapPaidDto[];

  @ApiPropertyOptional({
    example: 50000,
    description: 'مبلغ كاش مدفوع كـ سداد من ثمن الذهب (نادر الاستخدام)',
    default: 0,
  })
  @IsNumber()
  @IsOptional()
  cashPaidForGold?: number;

  @ApiPropertyOptional({
    example: 3800,
    description: 'سعر جرام الذهب المتفق عليه عند دفع كاش مقابل الذهب',
  })
  @IsNumber()
  @IsOptional()
  goldPriceForCashDeduction?: number;
}

export class RecordSupplierTransactionDto {
  @ApiProperty({
    example: '66e1a2b3c4d5e6f7a8b9c0d1',
    description: 'معرف المورد في قاعدة البيانات (MongoId)',
  })
  @IsMongoId({ message: 'معرف المورد غير صالح' })
  @IsNotEmpty()
  @Transform(({ value }) => (value === '' ? undefined : value))
  supplierId: string;

  @ApiProperty({
    example: 'GOODS_RECEIVE',
    enum: ['GOODS_RECEIVE', 'PAYMENT', 'ADJUSTMENT'],
    description: 'نوع المعاملة',
  })
  @IsString()
  @IsIn(['GOODS_RECEIVE', 'PAYMENT', 'ADJUSTMENT'])
  type: string;

  @ApiPropertyOptional({
    type: [ReceivedItemDto],
    description: 'قائمة الذهب والمشغولات المستلمة من المورد',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceivedItemDto)
  @IsOptional()
  receivedItems?: ReceivedItemDto[];

  @ApiPropertyOptional({
    type: PaymentDetailsDto,
    description: 'تفاصيل السداد (مصنعية كاش / كسر / كاش مقابل ذهب)',
  })
  @ValidateNested()
  @Type(() => PaymentDetailsDto)
  @IsOptional()
  paymentDetails?: PaymentDetailsDto;

  @ApiPropertyOptional({
    example: 'استلام نص كيلو ذهب عيار 21 وسداد المصنعية كاش والذهب كسر',
    description: 'ملاحظات الحركة',
  })
  @IsString()
  @IsOptional()
  notes?: string;
}