import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class CreateIncomeDto {
  @ApiProperty({ example: 5000, description: 'المبلغ المالي المضاف للدرج' })
  @IsNumber({}, { message: 'المبلغ يجب أن يكون رقماً' })
  @Min(0.01, { message: 'المبلغ يجب أن يكون أكبر من الصفر' })
  @IsNotEmpty({ message: 'المبلغ مطلوب' })
  amount: number;

  @ApiProperty({
    example: 'إيداع سيولة إضافية بالدرج',
    description: 'سبب الدخل',
  })
  @IsString({ message: 'السبب يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'سبب الدخل مطلوب' })
  reason: string;
}
