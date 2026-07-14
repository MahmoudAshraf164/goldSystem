import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateCustomerDto {
  @ApiPropertyOptional({ example: 'أحمد محمد علي المعدل' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: '01198765432' })
  @IsOptional()
  @IsString()
  @Matches(/^01[0125][0-9]{8}$/, {
    message: 'رقم الهاتف يجب أن يكون رقم مصري صحيح',
  })
  phoneNumber?: string;

  @ApiPropertyOptional({ example: '29501011234567' })
  @IsOptional()
  @IsString()
  @Length(14, 14, { message: 'الرقم القومي يجب أن يكون 14 رقم' })
  nationalId?: string;

  @ApiPropertyOptional({ example: 'الجيزة، مصر' })
  @IsOptional()
  @IsString()
  address?: string;
}
