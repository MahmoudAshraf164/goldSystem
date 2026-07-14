import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StockMovementsService } from './stock-movements.service';
import { StockMovementsController } from './stock-movements.controller';
import {
  StockMovement,
  StockMovementSchema,
} from './schemas/stock-movement.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StockMovement.name, schema: StockMovementSchema },
    ]),
  ],
  controllers: [StockMovementsController],
  providers: [StockMovementsService],
  exports: [StockMovementsService], // نعمل export عشان نستخدمه جوه الـ Inventory والـ Sales
})
export class StockMovementsModule {}
