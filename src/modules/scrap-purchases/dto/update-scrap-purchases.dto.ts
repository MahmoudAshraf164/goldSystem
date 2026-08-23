import { PartialType } from '@nestjs/swagger';
import { CreateScrapPurchaseDto } from './create-scrap-purchases.dto';

export class UpdateScrapPurchaseDto extends PartialType(
  CreateScrapPurchaseDto,
) {}
