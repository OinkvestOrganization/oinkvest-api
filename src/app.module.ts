import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuthModule } from './auth/auth.module';
import { BinanceStreamClientModule } from './binance-stream-client/binance-stream-client.module';
import { EmailModule } from './email/email.module';
import { KlineAdminModule } from './kline-admin/kline-admin.module';
import { KlineServerModule } from './kline-server/kline-server.module';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';
import { WalletModule } from './wallet/wallet.module';
import { TradeModule } from './trade/trade.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    EventEmitterModule.forRoot({
      wildcard: true,
    }),
    PrismaModule,
    UserModule,
    AuthModule,
    EmailModule,
    KlineServerModule,
    KlineAdminModule,
    BinanceStreamClientModule,
    WalletModule,
    TradeModule,
  ],
})
export class AppModule {}
