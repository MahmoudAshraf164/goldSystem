import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SafeController } from './safe.controller';
import { SafeService } from './safe.service';
import { Safe, SafeSchema } from './schemas/safe.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Safe.name, schema: SafeSchema }]),
  ],
  controllers: [SafeController],
  providers: [SafeService],
  exports: [SafeService, MongooseModule], // تصدير الخدمة لتستدعيها فواتير البيع والمصاريف
})
export class SafeModule {}
