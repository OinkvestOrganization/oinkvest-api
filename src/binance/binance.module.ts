import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BinanceService } from './binance.service';
import { BinanceController } from './binance.controller';

@Module({
  imports: [HttpModule],
  providers: [BinanceService],
  controllers: [BinanceController],
  exports: [BinanceService],
})
export class BinanceModule {}