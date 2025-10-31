import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { EmailModule } from './email/email.module';
import { ConfigModule } from '@nestjs/config';
import { KlineServerModule } from './kline-server/kline-server.module';
import { KlineAdminModule } from './kline-admin/kline-admin.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BinanceStreamClientModule } from './binance-stream-client/binance-stream-client.module';
import { WalletService } from './wallet/wallet.service';
import { WalletController } from './wallet/wallet.controller';
import { WalletModule } from './wallet/wallet.module';

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
  ],
  providers: [AppService, WalletService],
  controllers: [WalletController],
})
export class AppModule {}
