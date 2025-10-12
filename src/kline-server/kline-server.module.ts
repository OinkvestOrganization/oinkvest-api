import { Global, Module } from '@nestjs/common';
import { KlineServerService } from './kline-server.service';
import { KlineServerGateway } from './kline-server.gateway';
import { AuthModule } from '@/auth/auth.module';
import { UserModule } from '@/user/user.module';
import { KlineHistoryService } from './kline-history.service';

@Module({
  imports: [AuthModule, UserModule],
  providers: [KlineServerGateway, KlineServerService, KlineHistoryService],
  exports: [KlineServerService, KlineHistoryService],
})
export class KlineServerModule{}
