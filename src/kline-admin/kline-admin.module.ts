import { Module } from '@nestjs/common';
import { KlineAdminController } from './kline-admin.controller';
import { KlineAdminService } from './kline-admin.service';
import { KlineServerModule } from '@/kline-server/kline-server.module';

@Module({
  imports: [KlineServerModule],
  controllers: [KlineAdminController],
  providers: [KlineAdminService],
  exports: [KlineAdminService],
})
export class KlineAdminModule {}
