import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { EmailModule } from './email/email.module';
import { ConfigModule } from '@nestjs/config';
import { KlineServerModule } from './kline-server/kline-server.module';
import { WsAdminModule } from './ws-admin/ws-admin.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BinanceStreamClientModule } from './binance-stream-client/binance-stream-client.module';

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
    WsAdminModule,
    BinanceStreamClientModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
