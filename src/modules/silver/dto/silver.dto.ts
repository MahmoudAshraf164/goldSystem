import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsNotEmpty,
  Min,
  IsDateString,
} from 'class-validator';
import { SilverKarat, SilverCategory } from '../schemas/silver-item.schema';

// DTO إضافة قطعة فضة جديدة للمخزون
export class CreateSilverItemDto {
  @ApiProperty({ description: 'عنوان أو اسم القطعة', example: 'سلسلة إيطالي عيار 925' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'عيار الفضة', enum: [600, 800, 900, 925, 1000], example: 925 })
  @IsEnum([600, 800, 900, 925, 1000])
  karat: number;

  @ApiProperty({ description: 'تصنيف القطعة', enum: SilverCategory, example: SilverCategory.CHAIN })
  @IsEnum(SilverCategory)
  category: string;

  @ApiProperty({ description: 'وزن القطعة بالجرام', example: 12.5 })
  @IsNumber()
  @Min(0.01)
  weight: number;

  @ApiPropertyOptional({ description: 'ملاحظات إضافية' })
  @IsOptional()
  @IsString()
  notes?: string;
}

// DTO البيع السريع (بدون فاتورة)
export class QuickSilverSaleDto {
  @ApiProperty({ description: 'معرف قطعة الفضة المراد بيعها (MongoDB ObjectId)' })
  @IsString()
  @IsNotEmpty()
  itemId: string;

  @ApiProperty({ description: 'سعر جرام الفضة وقت البيع', example: 45 })
  @IsNumber()
  @Min(0.1)
  pricePerGram: number;

  @ApiPropertyOptional({ description: 'ملاحظات البيع' })
  @IsOptional()
  @IsString()
  notes?: string;
}

// DTO شراء كسر الفضة من زبون
export class BuySilverScrapDto {
  @ApiProperty({ description: 'عيار الكسر', enum: [600, 800, 900, 925, 1000], example: 800 })
  @IsEnum([600, 800, 900, 925, 1000])
  karat: number;

  @ApiProperty({ description: 'وزن الكسر المشترى بالجرام', example: 50.25 })
  @IsNumber()
  @Min(0.01)
  weight: number;

  @ApiProperty({ description: 'سعر الجرام المشترى به الكسر', example: 38 })
  @IsNumber()
  @Min(0.1)
  pricePerGram: number;

  @ApiPropertyOptional({ description: 'اسم العميل (اختياري)', example: 'أحمد محمود' })
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiPropertyOptional({ description: 'رقم هاتف العميل (اختياري)', example: '01000000000' })
  @IsOptional()
  @IsString()
  customerPhone?: string;

  @ApiPropertyOptional({ description: 'ملاحظات العملية' })
  @IsOptional()
  @IsString()
  notes?: string;
}

// DTO طلب تقرير الفترة الزمانية
export class SilverReportQueryDto {
  @ApiPropertyOptional({ description: 'تاريخ البداية (ISO String)', example: '2026-09-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'تاريخ النهاية (ISO String)', example: '2026-09-30T23:59:59.999Z' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}