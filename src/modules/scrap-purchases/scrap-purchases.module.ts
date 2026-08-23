import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ScrapPurchase,
  ScrapPurchaseSchema,
} from './schemas/scrap-purchases.schema';
import { ScrapPurchasesService } from './scrap-purchases.service';
import { ScrapPurchasesController } from './scrap-purchases.controller';
import { ScrapGoldModule } from '../scrap-gold/scrap-gold.module';
import { SafeModule } from '../safe/safe.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ScrapPurchase.name, schema: ScrapPurchaseSchema },
    ]),
    ScrapGoldModule,
    SafeModule,
  ],
  controllers: [ScrapPurchasesController],
  providers: [ScrapPurchasesService],
  exports: [ScrapPurchasesService, MongooseModule],
})
export class ScrapPurchasesModule {}
