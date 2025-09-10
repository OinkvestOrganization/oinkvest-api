import { Module } from '@nestjs/common';
import { WsServerService } from './ws-server.service';
import { WsServerGateway } from './ws-server.gateway';

@Module({
  providers: [WsServerGateway, WsServerService],
})
export class WsServerModule {}
