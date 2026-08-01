import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBullionSaleItemDto {
  @ApiProperty({
    example: '6a6de093e37b3b663f0a6241',
    description: 'معرّف السبيكة أو الجنيه من مخزن السبايك',
  })
  @IsNotEmpty({ message: 'معرف السبيكة/الجنيه مطلوب' })
  @IsMongoId({ message: 'معرف السبيكة يجب أن يكون ObjectId صحيح' })
  bullionItem: string;

  @ApiProperty({
    example: 2,
    description: 'عدد القطع المراد بيعها',
  })
  @IsNotEmpty({ message: 'الكمية المباعة مطلوبة' })
  @IsNumber()
  @Min(1, { message: 'يجب بيع قطعة واحدة على الأقل' })
  quantity: number;

  @ApiProperty({
    example: 4100,
    description:
      'سعر جرام الذهب المعتمد وقت البيع (عيار 24 للسبايك أو 21 للجنيهات)',
  })
  @IsNotEmpty({ message: 'سعر جرام الذهب مطلوب' })
  @IsNumber()
  @Min(1)
  goldPricePerGram: number;

  @ApiPropertyOptional({
    example: 350,
    description:
      'مصنعية القطعة الواحدة (إذا ترك فارغاً سيتم سحبه تلقائياً من قيمة المخزن)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  makingChargePerUnit?: number;
}

export class CreateBullionSaleDto {
  @ApiProperty({
    example: '6a592fb38000377ca873b407',
    description: 'معرف العميل المسجل في النظام (من موديول العملاء)',
  })
  @IsNotEmpty({ message: 'معرف العميل مطلوب' })
  @IsMongoId({ message: 'معرف العميل يجب أن يكون ObjectId صحيح' })
  customerId: string;

  @ApiProperty({
    type: [CreateBullionSaleItemDto],
    description: 'قائمة الأصناف المباعة بالفاتورة',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBullionSaleItemDto)
  items: CreateBullionSaleItemDto[];
}
