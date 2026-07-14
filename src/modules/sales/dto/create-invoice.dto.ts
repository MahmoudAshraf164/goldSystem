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
    example: 12.5,
    description: 'الوزن الإجمالي المدخل من الميزان شامل التيكت إن وجد',
  })
  @IsNumber()
  @Min(0.001, { message: 'الوزن الإجمالي يجب أن يكون أكبر من صفر' })
  soldGrossWeight: number;

  @ApiProperty({
    example: true,
    description:
      'هل الوزن شامل ورقة التيكت؟ لو true يخصم وزن تيكت الشركة ديناميكياً، لو false ينزل الصافي كامل',
  })
  @IsBoolean()
  @IsNotEmpty()
  hasTag: boolean;

  // 🛠️ الحقل الجديد لاستقبال وزن التيكت الفعلي المختار من الواجهة
  @ApiPropertyOptional({
    example: 0.04,
    description:
      'وزن التيكت المحدد والمبعوث من شاشة البيع (اختياري، في حال عدم إرساله يؤخذ أول وزن متاح بالمخزن)',
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

  @ApiProperty({ example: 150, description: 'سعر مصنعية الجرام الواحد للقطعة' })
  @IsNumber()
  @Min(0)
  makingChargesPerGram: number;
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
}
