import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty({ example: 'أحمد محمد علي' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: '01123456789' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^01[0125][0-9]{8}$/, {
    message: 'رقم الهاتف يجب أن يكون رقم مصري صحيح',
  })
  phoneNumber: string;

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
