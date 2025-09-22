import { Global, Module } from '@nestjs/common';
import { WsServerService } from './ws-server.service';
import { WsServerGateway } from './ws-server.gateway';
import { AuthModule } from '@/auth/auth.module';
import { UserModule } from '@/user/user.module';

@Module({
  imports: [AuthModule, UserModule],
  providers: [WsServerGateway, WsServerService],
  exports: [WsServerService]
})
export class WsServerModule {}
