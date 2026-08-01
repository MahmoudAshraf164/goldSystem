import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, Min } from 'class-validator';

export class AddQuantityDto {
  @ApiProperty({
    example: 5,
    description: 'عدد القطع المراد إضافتها وتزويدها على المخزون الحالي',
  })
  @IsNotEmpty({ message: 'الكمية المضافة مطلوبة' })
  @IsNumber({}, { message: 'الكمية المضافة يجب أن تكون رقماً' })
  @Min(1, { message: 'الكمية المضافة يجب أن تكون قطعة واحدة على الأقل' })
  addedQuantity: number;
}
