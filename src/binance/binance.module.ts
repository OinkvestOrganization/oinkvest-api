import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BinanceSpotClientService } from './binance-spot-client.service';

@Module({
  imports: [HttpModule],
  providers: [BinanceSpotClientService],
  exports: [BinanceSpotClientService],
})
export class BinanceModule {}
