import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { EmailModule } from './email/email.module';
import { ConfigModule } from '@nestjs/config';
import { WsServerGateway } from './ws-server/ws-server.gateway';
import { WsServerService } from './ws-server/ws-server.service';
import { WsServerModule } from './ws-server/ws-server.module';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    UserModule,
    AuthModule,
    EmailModule,
    WsServerModule,
  ],
  controllers: [AppController],
  providers: [AppService, WsServerGateway, WsServerService],
})
export class AppModule {}
