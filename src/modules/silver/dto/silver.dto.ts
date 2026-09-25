import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsNotEmpty,
  Min,
  IsDateString,
  IsMongoId,
  IsPositive,
} from 'class-validator';

// Enum لنطاقات التقارير الزمنية المتاحة
export enum ReportRangeType {
  TODAY = 'today',
  YESTERDAY = 'yesterday',
  LAST_7_DAYS = 'last_7_days',
  THIS_MONTH = 'this_month',
  LAST_MONTH = 'last_month',
  CUSTOM = 'custom',
}

// ----------------------------------------------------
// 1. Stock Operations DTOs
// ----------------------------------------------------

export class AddStockDto {
  @ApiProperty({ description: 'الوزن المضاف بالجرام', example: 15.5 })
  @IsNumber({}, { message: 'الوزن المضاف يجب أن يكون رقماً' })
  @IsPositive({ message: 'الوزن المضاف يجب أن يكون أكبر من الصفر' })
  addedWeight: number;

  @ApiPropertyOptional({ description: 'الكمية المضافة (افتراضي 1)', example: 1 })
  @IsOptional()
  @IsNumber({}, { message: 'الكمية المضافة يجب أن تكون رقماً' })
  @IsPositive({ message: 'الكمية يجب أن تكون أكبر من الصفر' })
  addedQuantity?: number;
}

// ----------------------------------------------------
// 2. Create Item DTOs
// ----------------------------------------------------

export class CreateSilverItemDto {
  @ApiProperty({ description: 'عنوان أو اسم القطعة', example: 'سلسلة إيطالي عيار 925' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'عيار الفضة', enum: [600, 800, 900, 925, 1000], example: 925 })
  @IsEnum([600, 800, 900, 925, 1000])
  karat: number;

  @ApiProperty({ description: 'معرف التصنيف الديناميكي (Category ObjectId)', example: '64f1ab23cd9e123456789abc' })
  @IsMongoId()
  @IsNotEmpty()
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

export class FilterSilverItemsDto {
  @ApiPropertyOptional({ description: 'بحث باسم القطعة أو الكود' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'عيار الفضة المراد الفلترة به', enum: [600, 800, 900, 925, 1000] })
  @IsOptional()
  @IsEnum([600, 800, 900, 925, 1000])
  karat?: number;

  @ApiPropertyOptional({ description: 'معرف التصنيف' })
  @IsOptional()
  @IsMongoId()
  category?: string;

  @ApiPropertyOptional({ description: 'حالة القطعة (مثلاً: available, sold, scrap)' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'رقم الصفحة للتقسيم', example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'عدد العناصر في الصفحة', example: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;
}

// ----------------------------------------------------
// 3. Quick Sale & Invoice Cancel DTOs
// ----------------------------------------------------

export class QuickSilverSaleDto {
  @ApiProperty({ description: 'معرف قطعة الفضة (MongoDB ObjectId)' })
  @IsMongoId()
  @IsNotEmpty()
  itemId: string;

  @ApiProperty({ description: 'سعر جرام الفضة وقت البيع', example: 45 })
  @IsNumber()
  @Min(0.1)
  pricePerGram: number;

  @ApiPropertyOptional({ description: 'اسم العميل', example: 'محمد علي' })
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiPropertyOptional({ description: 'رقم هاتف العميل', example: '01012345678' })
  @IsOptional()
  @IsString()
  customerPhone?: string;

  @ApiPropertyOptional({ description: 'ملاحظات عملية البيع' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CancelSilverInvoiceDto {
  @ApiPropertyOptional({ description: 'سبب إلغاء الفاتورة', example: 'طلب العميل الإرجاع' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ReturnSilverSaleDto {
  @ApiProperty({ description: 'معرف عملية البيع المراد استرجاعها' })
  @IsMongoId()
  @IsNotEmpty()
  saleId: string;

  @ApiPropertyOptional({ description: 'سبب مرتجع البيع', example: 'استبدال أو إلغاء الطلب' })
  @IsOptional()
  @IsString()
  reason?: string;
}

// ----------------------------------------------------
// 4. Scrap Silver Buy & Sell DTOs
// ----------------------------------------------------

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

  @ApiPropertyOptional({ description: 'اسم العميل', example: 'أحمد محمود' })
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiPropertyOptional({ description: 'رقم هاتف العميل', example: '01000000000' })
  @IsOptional()
  @IsString()
  customerPhone?: string;

  @ApiPropertyOptional({ description: 'ملاحظات العملية' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class SellSilverScrapDto {
  @ApiProperty({ description: 'عيار الكسر المراد بيعه', enum: [600, 800, 900, 925, 1000], example: 925 })
  @IsEnum([600, 800, 900, 925, 1000])
  karat: number;

  @ApiProperty({ description: 'وزن الكسر المباع بالجرام', example: 30.0 })
  @IsNumber()
  @Min(0.01)
  weight: number;

  @ApiProperty({ description: 'سعر جرام الكسر المباع', example: 42 })
  @IsNumber()
  @Min(0.1)
  pricePerGram: number;

  @ApiPropertyOptional({ description: 'اسم المشتري / التاجر', example: 'شركة الفضة الوطنية' })
  @IsOptional()
  @IsString()
  buyerName?: string;

  @ApiPropertyOptional({ description: 'ملاحظات العملية' })
  @IsOptional()
  @IsString()
  notes?: string;
}

// ----------------------------------------------------
// 5. Safe Adjustment & Reports DTOs
// ----------------------------------------------------

export class AdjustSilverSafeDto {
  @ApiProperty({ description: 'المبلغ الجديد المراد تسوية الخزنة به أو القيمة المضافة/المخصومة', example: 5000 })
  @IsNumber()
  amount: number;

  @ApiProperty({ description: 'كلمة سر الحماية الخاصة بآدمن/مالك النظام لتحقيق الأمان', example: 'AdminSafe#2026' })
  @IsString()
  @IsNotEmpty()
  securityPassword: string;

  @ApiPropertyOptional({ description: 'سبب التعديل أو التصفير', example: 'جرد أسبوعي وتسوية الخزنة' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class SilverReportQueryDto {
  @ApiPropertyOptional({
    description: 'نطاق التتقرير الزمني (today, yesterday, last_7_days, this_month, last_month, custom)',
    enum: ReportRangeType,
    example: ReportRangeType.TODAY,
  })
  @IsOptional()
  @IsEnum(ReportRangeType)
  rangeType?: ReportRangeType;

  @ApiPropertyOptional({ description: 'تاريخ البداية (ISO String) في حالة اختيار custom', example: '2026-09-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'تاريخ النهاية (ISO String) في حالة اختيار custom', example: '2026-09-30T23:59:59.999Z' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'نوع التقرير المحدد (اختياري)' })
  @IsOptional()
  @IsString()
  type?: string;
}

export class UpdateSilverSafePasswordDto {
  @ApiPropertyOptional({ description: 'كلمة السر القديمة (غير مطلوبة عند الضبط لأول مرة)', example: 'OldPassword123' })
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @ApiProperty({ description: 'كلمة السر الجديدة لخزنة الفضة', example: 'NewSafePass2026' })
  @IsString()
  @IsNotEmpty({ message: 'كلمة السر الجديدة مطلوبة' })
  newPassword: string;
}

// DTO جديد/محدث للاستعلام عن الرصيد بكلمة السر
export class GetSilverSafeBalanceDto {
  @ApiProperty({ description: 'كلمة سر خزنة الفضة لعرض الرصيد', example: 'NewSafePass2026' })
  @IsString()
  @IsNotEmpty({ message: 'كلمة السر مطلوبة لعرض الرصيد' })
  securityPassword: string;
}