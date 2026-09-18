import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  IsNotEmpty,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBarcodeItemDto {
  @ApiPropertyOptional({
    description:
      'رمز الباركود (أرقام فقط)، وفي حال عدم إرساله يقوم النظام بتوليده تلقائياً بناءً على العيار والسنة',
    example: '21202600001',
  })
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiProperty({
    description: 'اسم/عنوان القطعة الذهبية',
    example: 'خاتم سوليتير عيار 21',
  })
  @IsString()
  @IsNotEmpty({ message: 'عنوان القطعة مطلوب' })
  title: string;

  @ApiProperty({
    description: 'عيار الذهب (18، 21، أو 24)',
    enum: [18, 21, 24],
    example: 21,
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'يجب أن يكون العيار رقماً' })
  @IsIn([18, 21, 24], { message: 'العيار يجب أن يكون 18 أو 21 أو 24' })
  karat: number;

  @ApiProperty({
    description: 'الوزن القائم (الإجمالي) بالجرام شامل التاج',
    example: 5.45,
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'يجب أن يكون الوزن القائم رقماً' })
  @Min(0.001, { message: 'الوزن القائم يجب أن يكون أكبر من 0' })
  grossWeight: number;

  @ApiPropertyOptional({
    description: 'وزن التاج المخصوم بالجرام',
    example: 0.12,
    default: 0.06,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'وزن التاج يجب أن يكون رقماً' })
  @Min(0, { message: 'وزن التاج لا يمكن أن يكون بالسالب' })
  tagWeight?: number;

  @ApiProperty({ description: 'مصنعية الجرام الواحد للقطعة', example: 150.0 })
  @Type(() => Number)
  @IsNumber({}, { message: 'المصنعية يجب أن تكون رقماً' })
  @Min(0, { message: 'المصنعية لا يمكن أن تكون بالسالب' })
  makingChargePerGram: number;

  @ApiPropertyOptional({
    description: 'معرف التصنيف / الفئة التابعة لها القطعة',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'معرف عنصر المخزون العام المربوط مباشرة (اختياري)',
  })
  @IsOptional()
  @IsString()
  inventoryId?: string;

  @ApiPropertyOptional({
    description: 'اسم الشركة أو المورد / المصنع للقطعة',
    example: 'لازوردي',
  })
  @IsOptional()
  @IsString()
  companyName?: string;

  // 🟢 حقل رفع ملف الصورة فقط من الجهاز
  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'ملف صورة القطعة من الجهاز',
  })
  @IsOptional()
  file?: any;
}
