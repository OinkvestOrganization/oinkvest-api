import { Global, Module } from '@nestjs/common';
import { WsServerService } from './ws-server.service';
import { WsServerGateway } from './ws-server.gateway';
import { AuthModule } from '@/auth/auth.module';
import { UserModule } from '@/user/user.module';
import { BinanceModule } from '@/binance/binance.module';

@Global()
@Module({
  imports: [AuthModule, UserModule, BinanceModule],
  providers: [WsServerGateway, WsServerService],
  exports: [WsServerService],
})
export class WsServerModule {}
