import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'محمود الشيمي المعدل' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: '01098765432' })
  @IsOptional()
  @IsString()
  @Matches(/^01[0125][0-9]{8}$/, {
    message: 'رقم الهاتف يجب أن يكون رقم مصري صحيح',
  })
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'ACTIVE', enum: ['ACTIVE', 'INACTIVE'] })
  @IsOptional()
  @IsEnum(['ACTIVE', 'INACTIVE'])
  status?: string;

  @ApiPropertyOptional({ example: 'الجيزة، مصر' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'NewPassword123!' })
  @IsOptional()
  @IsString()
  @Length(6, 50)
  password?: string;
}
