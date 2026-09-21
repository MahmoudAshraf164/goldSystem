import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SilverController } from './silver.controller';
import { SilverService } from './silver.service';
import { SilverItem, SilverItemSchema } from './schemas/silver-item.schema';
import { SilverSale, SilverSaleSchema } from './schemas/silver-sale.schema';
import {
  SilverScrapPurchase,
  SilverScrapPurchaseSchema,
} from './schemas/silver-scrap-purchase.schema';
import {
  SilverSafeTransaction,
  SilverSafeTransactionSchema,
} from './schemas/silver-safe-transaction.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SilverItem.name, schema: SilverItemSchema },
      { name: SilverSale.name, schema: SilverSaleSchema },
      { name: SilverScrapPurchase.name, schema: SilverScrapPurchaseSchema },
      { name: SilverSafeTransaction.name, schema: SilverSafeTransactionSchema },
    ]),
  ],
  controllers: [SilverController],
  providers: [SilverService],
  exports: [SilverService],
})
export class SilverModule {} 