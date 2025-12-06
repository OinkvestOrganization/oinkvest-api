import { Controller, Get, Param } from '@nestjs/common';
import { BinanceRestClientService } from './binance-rest-client.service';

@Controller('binance')
export class BinanceController {
  constructor(private readonly binanceClient: BinanceRestClientService) {}

  @Get('filters/:symbol')
  async getSymbolFilters(@Param('symbol') symbol: string) {
    return this.binanceClient.getSymbolFiltersForFrontend(symbol);
  }
}
