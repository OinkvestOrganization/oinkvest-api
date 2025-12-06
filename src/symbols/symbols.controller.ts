import { Controller, Get, Query } from '@nestjs/common';
import { SymbolsService } from './symbols.service';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BinanceExchangeInfo } from './dto/binance-exchange-info.dto';

@Controller('symbols')
export class SymbolsController {
  constructor(private readonly symbolsService: SymbolsService) {}

  @ApiOperation({
    summary: 'Pares de moedas',
    description:
      'Busca todos os pares de moedas disponíveis para SPOT trading na Binance',
    tags: ['Symbols'],
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de pares de moedas',
  })
  @Get()
  async getSymbols(@Query('partialSymbol') partialSymbol?: string) {
    if (!partialSymbol) {
      return await this.symbolsService.searchPair();
    }
    return await this.symbolsService.searchPair(partialSymbol);
  }
}
