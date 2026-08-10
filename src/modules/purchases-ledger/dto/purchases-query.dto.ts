import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString } from 'class-validator';

export class PurchasesQueryDto {
  @ApiPropertyOptional({
    example: '2026-07-01',
    description: 'تاريخ بداية فحص المشتريات YYYY-MM-DD',
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-07-03',
    description: 'تاريخ نهاية فحص المشتريات YYYY-MM-DD',
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({
    example: 'TODAY',
    enum: ['TODAY', 'YESTERDAY', 'WEEKLY', 'MONTHLY'], // 👈 تم تنظيفها لتشمل المطلوب فقط
    description: 'فلاتر سريعة',
  })
  @IsString()
  @IsOptional()
  preset?: 'TODAY' | 'YESTERDAY' | 'WEEKLY' | 'MONTHLY';
}
