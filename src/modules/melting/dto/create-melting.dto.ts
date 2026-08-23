import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateMeltingDto {
  @IsNumber()
  karat: number;

  @IsNumber()
  @Min(0.01, { message: 'يجب أن يكون الوزن قبل التسييح أكبر من صفر' })
  rawWeightBeforeMelting: number;

  @IsNumber()
  @Min(0.01, { message: 'يجب أن يكون الوزن بعد التسييح أكبر من صفر' })
  netWeightAfterMelting: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
