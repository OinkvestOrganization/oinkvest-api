import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { EmailModule } from './email/email.module';
import { ConfigModule } from '@nestjs/config';
import { WsServerModule } from './ws-server/ws-server.module';
import { WsAdminModule } from './ws-admin/ws-admin.module';
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
    WsAdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
