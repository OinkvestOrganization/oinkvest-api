import { Module } from '@nestjs/common';
import { WsAdminController } from './ws-admin.controller';
import { WsAdminService } from './ws-admin.service';
import { KlineServerModule } from '@/kline-server/kline-server.module';

@Module({
  imports: [KlineServerModule],
  controllers: [WsAdminController],
  providers: [WsAdminService],
  exports: [WsAdminService],
})
export class WsAdminModule {}
