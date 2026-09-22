import { PartialType } from '@nestjs/swagger';
import { CreateSilverItemDto } from './silver.dto';

export class UpdateSilverItemDto extends PartialType(CreateSilverItemDto) {}