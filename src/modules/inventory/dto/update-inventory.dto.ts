import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { CreateInventoryDto } from './create-inventory.dto';

export class UpdateInventoryDto extends PartialType(CreateInventoryDto) {
  @ApiPropertyOptional({ example: 'خاتم إيجيبت جولد', description: 'عنوان مجموعة المخزون' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'إيجيبت جولد', description: 'اسم الشركة' })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({ example: '6a9f5848a9dc815a6aee102a', description: 'معرف القسم (Category ObjectId)' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 42, description: 'العدد الأولي المباشر للمجموعة' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  initialCount?: number;

  @ApiPropertyOptional({ example: 150.5, description: 'الوزن القائم الأولي المباشر للمجموعة' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  initialGrossWeight?: number;
}