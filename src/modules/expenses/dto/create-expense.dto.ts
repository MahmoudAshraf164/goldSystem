import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, Min, IsIn } from 'class-validator';

export class CreateExpenseDto {
  @ApiProperty({
    example: 'شراء مقشة جديدة للمحل',
    description: 'سبب خروج الفلوس أو بيان المصروف بالتفصيل',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example: 150,
    description: 'المبلغ المالي المخصوم والخارج من الخزنة كاش',
  })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({
    example: 'SHOP_EXPENSES',
    enum: ['GOLD_PURCHASE', 'SHOP_EXPENSES', 'SALARIES', 'OTHERS'],
    description:
      'تصنيف الحركة المخرجة (GOLD_PURCHASE: مشتريات الذهب | SHOP_EXPENSES: مصاريف المحم والنثريات)',
  })
  @IsString()
  @IsIn(['GOLD_PURCHASE', 'SHOP_EXPENSES', 'SALARIES', 'OTHERS'])
  category: string;
}
