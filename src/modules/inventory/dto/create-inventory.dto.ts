import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TagDetailDto {
  @ApiProperty({ example: 5, description: 'عدد القطع' })
  @IsNumber()
  @Min(0)
  count: number;

  @ApiProperty({ example: 0.04, description: 'وزن التيكت الخاص بهذه القطع' })
  @IsNumber()
  @Min(0)
  weight: number;
}

export class CreateInventoryDto {
  @ApiProperty({ example: 'سبيكة ذهب بي تي سي' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: 'BTC', description: 'اسم الشركة (اختياري)' })
  @IsString()
  @IsOptional()
  companyName?: string;

  @ApiProperty({ example: '6a35b977e361c7755f0f7a46' })
  @IsMongoId()
  @IsNotEmpty()
  category: string;

  @ApiProperty({ example: 24, enum: [18, 21, 24] })
  @IsNumber()
  @IsEnum([18, 21, 24], {
    message: 'العيار يجب أن يكون إما 18 أو 21 أو 24 فقط',
  })
  karat: number;

  @ApiProperty({ example: 10, minimum: 1 })
  @IsNumber()
  @Min(1, { message: 'العدد الابتدائي يجب أن يكون قطعة واحدة على الأقل' })
  initialCount: number;

  @ApiProperty({ example: 100.0 })
  @IsNumber()
  @Min(0.001, { message: 'الوزن الإجمالي يجب أن يكون أكبر من صفر' })
  totalGrossWeight: number;

  @ApiPropertyOptional({
    type: [TagDetailDto],
    description: 'تفاصيل أوزان التيكت المتعددة (اختياري)',
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => TagDetailDto)
  tagDetails?: TagDetailDto[];
}
