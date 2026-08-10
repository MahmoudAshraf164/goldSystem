import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  Min,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInvoiceItemDto {
  @ApiProperty({
    example: '6a4bb4eb0ec1a43ee0d265bd',
    description: 'ID البضاعة من المخزن (Inventory ID)',
  })
  @IsMongoId()
  @IsNotEmpty()
  inventoryItem: string;

  @ApiProperty({
    example: 3,
    description: 'عدد القطع المباعة من نفس هذا الصنف (مثال: 3 خواتم)',
  })
  @IsNumber()
  @Min(1, { message: 'يجب بيع قطعة واحدة على الأقل' })
  soldCount: number; // 👈 إضافة عدد القطع المجمعة

  @ApiProperty({
    example: 7.5,
    description:
      'الوزن الإجمالي المدخل من الميزان لجميع القطع معاً شامل التيكتات إن وجدت',
  })
  @IsNumber()
  @Min(0.001, { message: 'الوزن الإجمالي يجب أن يكون أكبر من صفر' })
  soldGrossWeight: number;

  @ApiProperty({
    example: true,
    description:
      'هل الوزن شامل ورقة التيكت؟ لو true يخصم وزن تيكت الشركة ديناميكياً للقطع الكلية',
  })
  @IsBoolean()
  @IsNotEmpty()
  hasTag: boolean;

  @ApiPropertyOptional({
    example: 0.06,
    description:
      'وزن التيكت المحدد (اختياري، في حال عدم إرساله يؤخذ أوزان التيكتات المتاحة بالمخزن تلقائياً)',
  })
  @IsNumber()
  @IsOptional()
  tagWeight?: number;

  @ApiProperty({
    example: 3850,
    description: 'سعر الجرام اليومي لهذا العيار وقت الفاتورة',
  })
  @IsNumber()
  @Min(0)
  goldPriceToday: number;

  @ApiProperty({ example: 150, description: 'سعر مصنعية الجرام الواحد للقطع' })
  @IsNumber()
  @Min(0)
  makingChargesPerGram: number;

  @ApiPropertyOptional({
    example: 30000,
    description: 'إجمالي سعر هذه المجموعه النهائي بعد الخصم/الفصال (اختياري)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  itemTotalPrice?: number;
}

export class CreateInvoiceDto {
  @ApiProperty({
    example: '6a35b977e361c7755f0f7a46',
    description: 'ID العميل المرتبط بالفاتورة',
  })
  @IsMongoId()
  @IsNotEmpty()
  customer: string;

  @ApiProperty({
    type: [CreateInvoiceItemDto],
    description: 'قائمة القطع المشغولات الذهبية المشتراة في الفاتورة',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items: CreateInvoiceItemDto[];

  @ApiPropertyOptional({
    example: 50000,
    description: 'إجمالي سعر الفاتورة بالكامل بعد الخصم (اختياري)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalPrice?: number;
}
