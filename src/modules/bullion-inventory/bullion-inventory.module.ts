import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  BullionInventory,
  BullionInventorySchema,
} from './schemas/bullion-inventory.schema';
import { BullionInventoryService } from './bullion-inventory.service';
import { BullionInventoryController } from './bullion-inventory.controller';
import { StockMovementsModule } from '../stock-movements/stock-movements.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BullionInventory.name, schema: BullionInventorySchema },
    ]),
    StockMovementsModule,
  ],
  controllers: [BullionInventoryController],
  providers: [BullionInventoryService],
  exports: [BullionInventoryService, MongooseModule],
})
export class BullionInventoryModule {}
