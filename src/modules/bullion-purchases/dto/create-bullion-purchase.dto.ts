import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBullionPurchaseItemDto {
  @ApiProperty({ description: 'معرف السبيكة/الجنيه من المخزن' })
  @IsMongoId({ message: 'معرف السبيكة غير صحيح' })
  @IsNotEmpty()
  bullionItem: string;

  @ApiProperty({ example: 1, description: 'العدد المشترى من العميل' })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: 3850, description: 'سعر جرام الشراء لحظة العملية' })
  @IsNumber()
  @Min(0)
  buyGoldPricePerGram: number;

  @ApiPropertyOptional({
    example: 25,
    description:
      'الكاش باك للقطعة الواحدة (اختياري، وإن لم يحدد يؤخذ من قيمة كاش باك القطعة بالسيستم)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cashbackPerUnit?: number;
}

export class CreateBullionPurchaseDto {
  @ApiProperty({ description: 'معرف العميل بائعة السبايك' })
  @IsMongoId({ message: 'معرف العميل غير صحيح' })
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({
    type: [CreateBullionPurchaseItemDto],
    description: 'قائمة الأصناف المشتراة',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBullionPurchaseItemDto)
  items: CreateBullionPurchaseItemDto[];

  @ApiPropertyOptional({ description: 'ملاحظات إضافية على عملية الشراء' })
  @IsOptional()
  @IsString()
  notes?: string;
}
