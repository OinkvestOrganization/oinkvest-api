import { Module } from '@nestjs/common';
import { WsAdminController } from './ws-admin.controller';
import { WsAdminService } from './ws-admin.service';
import { WsServerModule } from '@/ws-server/ws-server.module';

@Module({
  imports: [WsServerModule],
  controllers: [WsAdminController],
  providers: [WsAdminService],
  exports: [WsAdminService],
})
export class WsAdminModule {}
