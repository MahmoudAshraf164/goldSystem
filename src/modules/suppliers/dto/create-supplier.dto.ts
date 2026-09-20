import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateSupplierDto {
  @ApiProperty({
    example: 'ورشة السلام للذهب',
    description: 'اسم المورد أو الورشة',
  })
  @IsString()
  @IsNotEmpty({ message: 'اسم المورد مطلوب' })
  name: string;

  @ApiProperty({
    example: '01012345678',
    description: 'رقم هاتف المورد للتواصل',
  })
  @IsString()
  @IsNotEmpty({ message: 'رقم الهاتف مطلوب' })
  phone: string;

  @ApiPropertyOptional({
    example: 'شارع الصاغة، خان الخليلي، القاهرة',
    description: 'عنوان المورد أو الورشة (اختياري)',
  })
  @IsString()
  @IsOptional()
  address?: string;
}