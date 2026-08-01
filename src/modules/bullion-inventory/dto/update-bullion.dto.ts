import { PartialType } from '@nestjs/mapped-types';
import { CreateBullionDto } from './create-bullion.dto';

export class UpdateBullionDto extends PartialType(CreateBullionDto) {}
