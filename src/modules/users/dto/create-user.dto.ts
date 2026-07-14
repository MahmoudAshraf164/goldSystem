import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { Role } from '../../../common/enums/role.enum';

export class CreateUserDto {
  @ApiProperty({ example: 'محمود الشيمي' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: 'employee@gold.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Password123!', minLength: 6 })
  @IsString()
  @Length(6, 50)
  password: string;

  @ApiProperty({ example: '01012345678' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^01[0125][0-9]{8}$/, {
    message: 'رقم الهاتف يجب أن يكون رقم مصري صحيح',
  })
  phoneNumber: string;

  @ApiProperty({ enum: Role, example: Role.Employee })
  @IsEnum(Role)
  @IsNotEmpty()
  role: Role;

  // حقول اختيارية للموظف فقط
  @ApiPropertyOptional({ example: '29901011234567' })
  @IsOptional()
  @IsString()
  @Length(14, 14, { message: 'الرقم القومي يجب أن يكون 14 رقم' })
  nationalId?: string;

  @ApiPropertyOptional({ example: 'القاهرة، مصر' })
  @IsOptional()
  @IsString()
  address?: string;
}
