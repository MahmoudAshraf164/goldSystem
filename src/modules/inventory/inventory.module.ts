import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { Inventory, InventorySchema } from './schemas/inventory.schema';
import { StockMovementsModule } from '../stock-movements/stock-movements.module'; // 👈 استيراد الموديول الجديد هنا

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Inventory.name, schema: InventorySchema },
    ]),
    StockMovementsModule, // 👈 ضيف الموديول هنا عشان الـ InventoryService يقدر يشوف الـ StockMovementsService
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService, MongooseModule],
})
export class InventoryModule {}
