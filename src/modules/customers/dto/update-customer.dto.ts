import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, ValidateIf } from 'class-validator';

export class UpdateCustomerDto {
  @ApiPropertyOptional({ example: 'أحمد محمد علي المعدل' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: '01012345678' })
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.phoneNumber !== '' && o.phoneNumber !== null)
  @Matches(/^01[0125][0-9]{8}$/, {
    message: 'رقم الهاتف يجب أن يكون رقم مصري صحيح',
  })
  phoneNumber?: string;

  @ApiPropertyOptional({ example: '29501011234567' })
  @IsOptional()
  @IsString()
  nationalId?: string;

  @ApiPropertyOptional({ example: 'الجيزة، مصر' })
  @IsOptional()
  @IsString()
  address?: string;
}
