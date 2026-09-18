import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { Supplier, SupplierSchema } from './schemas/supplier.schema';
import {
  SupplierTransaction,
  SupplierTransactionSchema,
} from './schemas/supplier-transaction.schema';
import { ScrapGoldModule } from '../scrap-gold/scrap-gold.module';
import { SafeModule } from '../safe/safe.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Supplier.name, schema: SupplierSchema },
      { name: SupplierTransaction.name, schema: SupplierTransactionSchema },
    ]),
    ScrapGoldModule,
    SafeModule,
  ],
  controllers: [SuppliersController],
  providers: [SuppliersService],
  exports: [SuppliersService, MongooseModule],
})
export class SuppliersModule {}
