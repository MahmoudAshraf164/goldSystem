import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { BullionType } from '../schemas/bullion-inventory.schema';

export class CreateBullionDto {
  @ApiProperty({
    example: 'سبيكة 5 جرام BTC',
    description: 'عنوان السبيكة أو الجنيه الذهب للتوضيح العرض في القوائم',
  })
  @IsNotEmpty({ message: 'عنوان السبيكة/الجنيه مطلوب' })
  @IsString()
  title: string;

  @ApiProperty({
    example: BullionType.INGOT,
    enum: BullionType,
    description: 'نوع القطعة الذهب (INGOT: سبيكة | COIN: جنيه/نصف/ربع جنيه)',
  })
  @IsNotEmpty({ message: 'نوع القطعة مطلوب' })
  @IsEnum(BullionType, { message: 'نوع القطعة يجب أن يكون INGOT أو COIN' })
  type: BullionType;

  @ApiProperty({
    example: 'BTC',
    description: 'اسم الشركة المصنعة (BTC, Master Gold, SAM, Selim ...الخ)',
  })
  @IsNotEmpty({ message: 'اسم الشركة المصنعة مطلوب' })
  @IsString()
  companyName: string;

  @ApiProperty({
    example: 24,
    description: 'عيار القطعة (24 للسبايك أو 21 للجنيهات الذهب)',
  })
  @IsNotEmpty({ message: 'العيار مطلوب' })
  @IsNumber({}, { message: 'العيار يجب أن يكون رقماً' })
  karat: number;

  @ApiProperty({
    example: 5,
    description: 'وزن القطعة الواحدة بالجرام الصافي',
  })
  @IsNotEmpty({ message: 'وزن القطعة الواحدة مطلوب' })
  @IsNumber()
  @Min(0.1, { message: 'الوزن يجب أن يكون أكبر من 0' })
  weightPerUnit: number;

  @ApiProperty({
    example: 10,
    description: 'الكمية الابتدائية المضافة للخزنة/المخزن عند الإنشاء',
  })
  @IsNotEmpty({ message: 'الكمية الابتدائية مطلوبة' })
  @IsNumber()
  @Min(0, { message: 'الكمية لا يمكن أن تكون بالسالب' })
  quantity: number;

  @ApiPropertyOptional({
    example: 350,
    description: 'مصنعية البيع الثابتة للقطعة الواحدة بالجنيه المصري (اختياري)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  makingChargePerUnit?: number;

  @ApiPropertyOptional({
    example: 150,
    description:
      'قيمة الاسترداد والكاش باك المستحق للقطعة بالجنيه عند إعادتها بغلافها (اختياري)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cashbackPerUnit?: number;
}
