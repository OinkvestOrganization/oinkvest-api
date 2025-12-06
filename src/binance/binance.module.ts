import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BinanceRestClientService } from './binance-rest-client.service';
import { BinanceController } from './binance.controller';

@Module({
  imports: [HttpModule],
  controllers: [BinanceController],
  providers: [BinanceRestClientService],
  exports: [BinanceRestClientService],
})
export class BinanceModule {}
