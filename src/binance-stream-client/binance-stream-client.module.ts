import { Global, Module } from '@nestjs/common';
import { BinanceStreamClientService } from './binance-stream-client.service';
import { StreamStatusController } from './binance-stream-client.controller';
import { KlineServerModule } from '@/kline-server/kline-server.module';

@Global()
@Module({
  imports: [KlineServerModule],
  providers: [BinanceStreamClientService],
  exports: [BinanceStreamClientService],
  controllers: [StreamStatusController],
})
export class BinanceStreamClientModule {}
