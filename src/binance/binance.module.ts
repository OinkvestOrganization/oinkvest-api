import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BinanceRestClientService } from './binance-rest-client.service';

@Module({
  imports: [HttpModule],
  providers: [BinanceRestClientService],
  exports: [BinanceRestClientService],
})
export class BinanceModule {}
