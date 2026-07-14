import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScrapGoldService } from './scrap-gold.service';
import { ScrapGoldController } from './scrap-gold.controller';
import { ScrapGold, ScrapGoldSchema } from './schemas/scrap-gold.schema';
import {
  Category,
  CategorySchema,
} from '../categories/schemas/category.schema'; // 👈 استيراد اسكيما التصنيفات هنا
import { StockMovementsModule } from '../stock-movements/stock-movements.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ScrapGold.name, schema: ScrapGoldSchema },
      { name: Category.name, schema: CategorySchema }, // 👈 حقن اسكيما التصنيفات هنا في الموديول لربط الفحص
    ]),
    StockMovementsModule,
  ],
  controllers: [ScrapGoldController],
  providers: [ScrapGoldService],
  exports: [ScrapGoldService],
})
export class ScrapGoldModule {}
