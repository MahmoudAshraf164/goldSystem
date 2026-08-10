import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString } from 'class-validator';

export class LedgerQueryDto {
  @ApiPropertyOptional({
    example: '2026-07-01',
    description: 'تاريخ بداية الجرد YYYY-MM-DD',
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-07-03',
    description: 'تاريخ نهاية الجرد YYYY-MM-DD',
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({
    example: 'TODAY',
    enum: ['TODAY', 'YESTERDAY', 'WEEKLY'], // تنظيف الفلاتر لتطابق الفرونت إند بالظبط
    description: 'فلاتر سريعة جاهزة',
  })
  @IsString()
  @IsOptional()
  preset?: 'TODAY' | 'YESTERDAY' | 'WEEKLY';
}
