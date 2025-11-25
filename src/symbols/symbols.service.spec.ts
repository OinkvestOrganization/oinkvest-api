import { Test, TestingModule } from '@nestjs/testing';
import { SymbolsService } from './symbols.service';
import { BinanceRestClientService } from '@/binance/binance-rest-client.service';
import { getCacheManagerMock } from '@/common/utils/test-utils';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BinanceExchangeInfo } from './dto/binance-exchange-info.dto';

const mockExchangeInfoFromApi = {
  symbols: [
    {
      symbol: 'ETHBTC',
      status: 'TRADING',
      baseAsset: 'ETH',
      quoteAsset: 'BTC',
      permissions: ['SPOT'],
    },
    {
      symbol: 'LTCBTC',
      status: 'TRADING',
      baseAsset: 'LTC',
      quoteAsset: 'BTC',
      permissions: ['SPOT'],
    },
    {
      symbol: 'BTCUSDT',
      status: 'TRADING',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      permissions: ['SPOT'],
    },
    {
      symbol: 'BNBBTC',
      status: 'TRADING',
      baseAsset: 'BNB',
      quoteAsset: 'BTC',
      permissions: ['SPOT'],
    },
    {
      symbol: 'ADABTC',
      status: 'TRADING',
      baseAsset: 'ADA',
      quoteAsset: 'BTC',
      permissions: ['SPOT'],
    },
  ],
};

const mockFormattedPairs: BinanceExchangeInfo = {
  symbols: mockExchangeInfoFromApi.symbols.map((s) => ({
    symbol: s.symbol,
    baseAsset: s.baseAsset,
    quoteAsset: s.quoteAsset,
    permissions: s.permissions,
    status: s.status,
  })),
};

describe('SymbolsService', () => {
  let service: SymbolsService;
  let binanceClient: BinanceRestClientService;
  let cacheManager: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SymbolsService,
        {
          provide: BinanceRestClientService,
          useValue: {
            unsignedGet: jest.fn(),
          },
        },
        {
          provide: CACHE_MANAGER,
          useFactory: getCacheManagerMock,
        },
      ],
    }).compile();

    service = module.get<SymbolsService>(SymbolsService);
    binanceClient = module.get<BinanceRestClientService>(
      BinanceRestClientService,
    );
    cacheManager = module.get(CACHE_MANAGER);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSpotPairs', () => {
    it('should return data from cache if available', async () => {
      cacheManager.get.mockResolvedValue(mockFormattedPairs);
      const result = await service.getSpotPairs();

      expect(result).toEqual(mockFormattedPairs);
      expect(cacheManager.get).toHaveBeenCalledWith('binance_spot_pairs');
      expect(binanceClient.unsignedGet).not.toHaveBeenCalled();
    });

    it('should fetch from binance, format and cache the data if not in cache', async () => {
      cacheManager.get.mockResolvedValue(undefined);
      (binanceClient.unsignedGet as jest.Mock).mockResolvedValue(
        mockExchangeInfoFromApi,
      );

      const result = await service.getSpotPairs();

      expect(result).toEqual(mockFormattedPairs);
      expect(binanceClient.unsignedGet).toHaveBeenCalledWith(
        '/api/v3/exchangeInfo',
        { permissions: ['SPOT'] },
      );
      expect(cacheManager.set).toHaveBeenCalledWith(
        'binance_spot_pairs',
        mockFormattedPairs,
        3600000,
      );
    });

    it('should throw an error if binance client fails', async () => {
      cacheManager.get.mockResolvedValue(undefined);
      const error = new Error('Binance API error');
      (binanceClient.unsignedGet as jest.Mock).mockRejectedValue(error);

      await expect(service.getSpotPairs()).rejects.toThrow(error);
    });
  });

  describe('searchPair', () => {
    beforeEach(() => {
      // We can mock getSpotPairs as it's already tested
      jest.spyOn(service, 'getSpotPairs').mockResolvedValue(mockFormattedPairs);
    });

    it('should return all pairs if no search term is provided', async () => {
      const result = await service.searchPair();
      expect(result).toEqual(mockFormattedPairs);
    });

    it('should filter pairs based on the search term (case-insensitive)', async () => {
      const result = await service.searchPair('btc');
      expect(result.symbols).toHaveLength(5); // All symbols have BTC

      const result2 = await service.searchPair('usdt');
      expect(result2.symbols).toHaveLength(1);
      expect(result2.symbols[0].symbol).toBe('BTCUSDT');
    });

    it('should return an empty array if no symbol matches', async () => {
      const result = await service.searchPair('NOMATCH');
      expect(result.symbols).toHaveLength(0);
    });

    it('should sort the results correctly', async () => {
      const result = await service.searchPair('BTC');
      const symbols = result.symbols.map((s) => s.symbol);
      // Expected order:
      // 1. Starts with baseAsset 'BTC': 'BTCUSDT'
      // 2. Then by length: 'ADABTC', 'BNBBTC', 'ETHBTC', 'LTCBTC' (alphabetical for same length)
      expect(symbols).toEqual([
        'BTCUSDT',
        'ADABTC',
        'BNBBTC',
        'ETHBTC',
        'LTCBTC',
      ]);
    });
  });
});
