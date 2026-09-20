import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, IsNotEmpty, Min } from 'class-validator';

export class CreateScrapPurchaseDto {
  @ApiProperty({
    example: 'محمود أحمد',
    description: 'اسم الزبون المشتري منه',
  })
  @IsString()
  @IsNotEmpty({ message: 'اسم الزبون مطلوب' })
  customerName: string;

  @ApiProperty({
    example: '01012345678',
    description: 'رقم هاتف الزبون (اختياري)',
    required: false,
  })
  @IsOptional()
  @IsString()
  customerPhone?: string;

  @ApiProperty({
    example: 21,
    enum: [18, 21],
    description: 'العيار (18 أو 21)',
  })
  @IsNumber()
  @IsEnum([18, 21], { message: 'العيار يجب أن يكون 18 أو 21 فقط' })
  karat: number;

  @ApiProperty({ example: 5.0, description: 'الوزن المشتري بالجرام' })
  @IsNumber()
  @Min(0.001, { message: 'الوزن يجب أن يكون أكبر من صفر' })
  weight: number;

  @ApiProperty({
    example: 15000,
    description: 'المبلغ الإجمالي المدفوع للزبون كاش',
  })
  @IsNumber()
  @Min(0, { message: 'السعر لا يمكن أن يكون بالسالب' })
  totalPrice: number;

  @ApiProperty({ example: 'شراء أسورة كسر من زبون', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}