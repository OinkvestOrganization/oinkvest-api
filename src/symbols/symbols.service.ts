import { BinanceRestClientService } from '@/binance/binance-rest-client.service';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  BinanceExchangeInfo,
  BinanceSymbol,
} from './dto/binance-exchange-info.dto';

@Injectable()
export class SymbolsService {
  private readonly logger = new Logger(SymbolsService.name);
  private readonly CACHE_KEY = 'binance_spot_pairs';

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly binance: BinanceRestClientService,
  ) {}

  async getSpotPairs(): Promise<BinanceExchangeInfo> {
    const cachedData: BinanceExchangeInfo | undefined =
      await this.cacheManager.get(this.CACHE_KEY);
    if (cachedData) {
      this.logger.log('Retornando dados do cache');
      return cachedData;
    }
    try {
      this.logger.log('Cache vazio. Buscando dados da Binance...');
      const data = await this.binance.unsignedGet('/api/v3/exchangeInfo', {
        permissions: ['SPOT'],
      });

      const symbols = (data as any).symbols
        .filter((symbol: BinanceSymbol) => symbol.status === 'TRADING')
        .map((symbol: BinanceSymbol) => ({
          symbol: symbol.symbol,
          baseAsset: symbol.baseAsset,
          quoteAsset: symbol.quoteAsset,
        }));

      const spotPairs: BinanceExchangeInfo = { symbols };

      await this.cacheManager.set(this.CACHE_KEY, spotPairs, 3600000); // Ex: 1 hora (3.600.000 ms)
      this.logger.log('Dados da Binance armazenados no cache');
      return spotPairs;
    } catch (error) {
      this.logger.error('Erro ao buscar pares na Binance', error);
      throw error;
    }
  }

  async searchPair(partialSymbol?: string): Promise<BinanceExchangeInfo> {
    const foundSymbols = await this.getSpotPairs();

    if (!partialSymbol) {
      this.logger.log('Retornando todos os pares');
      return foundSymbols;
    }

    const searchParameter = partialSymbol.trim().replace(' ', '').toUpperCase();

    this.logger.log(`Buscando pares que contenham ${searchParameter}`);
    const filteredSymbols = foundSymbols.symbols.filter(
      (symbol) =>
        symbol.symbol.toUpperCase().includes(searchParameter) ||
        symbol.baseAsset.toUpperCase().includes(searchParameter) ||
        symbol.quoteAsset.toUpperCase().includes(searchParameter),
    );

    const sortedSymbols = filteredSymbols.sort((a, b) => {
      const aSymbol = a.symbol.toUpperCase();
      const bSymbol = b.symbol.toUpperCase();
      const aBase = a.baseAsset.toUpperCase();
      const bBase = b.baseAsset.toUpperCase();

      // Priority to base asset starting with search term
      if (
        aBase.startsWith(searchParameter) &&
        !bBase.startsWith(searchParameter)
      ) {
        return -1;
      }
      if (
        !aBase.startsWith(searchParameter) &&
        bBase.startsWith(searchParameter)
      ) {
        return 1;
      }

      // Then symbol starting with search term
      if (
        aSymbol.startsWith(searchParameter) &&
        !bSymbol.startsWith(searchParameter)
      ) {
        return -1;
      }
      if (
        !aSymbol.startsWith(searchParameter) &&
        bSymbol.startsWith(searchParameter)
      ) {
        return 1;
      }

      // Then by length
      if (aSymbol.length < bSymbol.length) {
        return -1;
      }
      if (aSymbol.length > bSymbol.length) {
        return 1;
      }

      // Finally alphabetical
      return aSymbol.localeCompare(bSymbol);
    });

    return { symbols: sortedSymbols };
  }
}
