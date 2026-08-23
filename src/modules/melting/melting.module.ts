import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MeltingController } from './melting.controller';
import { MeltingService } from './melting.service';
import { MeltingLog, MeltingLogSchema } from './schemas/melting-log.schema';
import { ScrapGoldModule } from '../scrap-gold/scrap-gold.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MeltingLog.name, schema: MeltingLogSchema },
    ]),
    ScrapGoldModule, // 👈 استيراد موديول الكسر هنا
  ],
  controllers: [MeltingController],
  providers: [MeltingService],
  exports: [MeltingService],
})
export class MeltingModule {}
