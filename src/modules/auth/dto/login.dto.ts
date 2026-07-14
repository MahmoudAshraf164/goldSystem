import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'owner@gold.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'SuperSecureOwnerPassword123!' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 50)
  password: string;
}
