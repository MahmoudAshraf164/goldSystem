import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { EventEmitterModule } from '@nestjs/event-emitter';

// استدعاء جميع موديولات النظام المترابطة
import { UsersModule } from './modules/users/users.module';
import { MailModule } from './modules/mail/mail.module';
import { AuthModule } from './modules/auth/auth.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { CustomersModule } from './modules/customers/customers.module';
import { SalesModule } from './modules/sales/sales.module';
import { StockMovementsModule } from './modules/stock-movements/stock-movements.module';
import { ScrapGoldModule } from './modules/scrap-gold/scrap-gold.module';
import { ScrapInvoicesModule } from './modules/scrap-invoices/scrap-invoices.module';
import { DailyLedgerModule } from './modules/daily-ledger/daily-ledger.module';
import { PurchasesLedgerModule } from './modules/purchases-ledger/purchases-ledger.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { IncomeModule } from './modules/income/income.module';
import { SafeModule } from './modules/safe/safe.module';
import { BullionInventoryModule } from './modules/bullion-inventory/bullion-inventory.module';
import { BullionSalesModule } from './modules/bullion-sales/bullion-sales.module';
import { BarcodeSalesModule } from './modules/barcode-sales/barcode-sales.module';
import { BarcodeInventoryModule } from './modules/barcode-inventory/barcode-inventory.module';

@Module({
  imports: [
    // 1. إدارة ملفات البيئة والإعدادات العامة
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV ?? 'development'}`,
    }),

    // 2. الاتصال غير المتزامن بقاعدة بيانات MongoDB المحمية
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const uri = config.get<string>('MONGO_URI');
        if (!uri) throw new Error('MONGO_URI is not defined');
        return {
          uri,
          tls: true,
          serverSelectionTimeoutMS: 10000,
          connectTimeoutMS: 10000,
          socketTimeoutMS: 45000,
          maxPoolSize: 10,
          minPoolSize: 0,
          bufferCommands: false,
          heartbeatFrequencyMS: 30000,
        };
      },
    }),

    // 3. تفعيل رادار بث واستقبال الأحداث الفورية (Event Driven Architecture)
    EventEmitterModule.forRoot(),

    // 4. تسجيل موديولات النظام المخصصة للإمبراطورية المحاسبية للذهب
    AuthModule,
    UsersModule,
    MailModule,
    CategoriesModule,
    InventoryModule,
    CustomersModule,
    SalesModule,
    StockMovementsModule,
    ScrapGoldModule,
    ScrapInvoicesModule,
    DailyLedgerModule,
    ExpensesModule,
    PurchasesLedgerModule,
    NotificationsModule,
    IncomeModule,
    SafeModule,
    BullionInventoryModule,
    BullionSalesModule,
    BarcodeInventoryModule,
    BarcodeSalesModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
