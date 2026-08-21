import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BarcodeInventoryController } from './barcode-inventory.controller';
import { BarcodeInventoryService } from './barcode-inventory.service';
import {
  BarcodeInventory,
  BarcodeInventorySchema,
} from './schemas/barcode-inventory.schema';
import { StockMovementsModule } from '../stock-movements/stock-movements.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BarcodeInventory.name, schema: BarcodeInventorySchema },
    ]),
    StockMovementsModule,
  ],
  controllers: [BarcodeInventoryController],
  providers: [BarcodeInventoryService],
  exports: [BarcodeInventoryService, MongooseModule],
})
export class BarcodeInventoryModule {}
