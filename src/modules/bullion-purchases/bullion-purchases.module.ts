import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullionPurchasesController } from './bullion-purchases.controller';
import { BullionPurchasesService } from './bullion-purchases.service';
import {
  BullionPurchase,
  BullionPurchaseSchema,
} from './schemas/bullion-purchase.schema';
import {
  BullionInventory,
  BullionInventorySchema,
} from '../bullion-inventory/schemas/bullion-inventory.schema';
import { Customer, CustomerSchema } from '../customers/schemas/customer.schema';
import { StockMovementsModule } from '../stock-movements/stock-movements.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BullionPurchase.name, schema: BullionPurchaseSchema },
      { name: BullionInventory.name, schema: BullionInventorySchema },
      { name: Customer.name, schema: CustomerSchema },
    ]),
    StockMovementsModule,
  ],
  controllers: [BullionPurchasesController],
  providers: [BullionPurchasesService],
  exports: [BullionPurchasesService],
})
export class BullionPurchasesModule {}
