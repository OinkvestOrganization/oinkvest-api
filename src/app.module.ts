import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CacheModule } from '@nestjs/cache-manager';
import { AuthModule } from './auth/auth.module';
import { BinanceStreamClientModule } from './binance-stream-client/binance-stream-client.module';
import { EmailModule } from './email/email.module';
import { KlineAdminModule } from './kline-admin/kline-admin.module';
import { KlineServerModule } from './kline-server/kline-server.module';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';
import { WalletModule } from './wallet/wallet.module';
import { SymbolsModule } from './symbols/symbols.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    EventEmitterModule.forRoot({
      wildcard: true,
    }),
    CacheModule.register({
      isGlobal: true,
      ttl: 600000,
      max: 100,
    }),
    PrismaModule,
    UserModule,
    AuthModule,
    EmailModule,
    KlineServerModule,
    KlineAdminModule,
    BinanceStreamClientModule,
    WalletModule,
    SymbolsModule,
  ],
})
export class AppModule {}
