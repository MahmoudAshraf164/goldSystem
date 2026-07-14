import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';

export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: 'غوايش عريضة' })
  @IsString()
  @IsOptional()
  @Length(2, 50, { message: 'اسم التصنيف يجب أن يكون بين 2 إلى 50 حرفاً' })
  name?: string; // جعلناه اختياري عشان لو المالك هيرجع الحالة بس من غير تعديل الاسم

  @ApiPropertyOptional({ example: 'ACTIVE', enum: ['ACTIVE', 'ARCHIVED'] })
  @IsOptional()
  @IsEnum(['ACTIVE', 'ARCHIVED'], {
    message: 'الحالة يجب أن تكون ACTIVE أو ARCHIVED',
  })
  status?: string; // 👈 إضافة حقل الحالة هنا لحل مشكلة الـ Validation
}
