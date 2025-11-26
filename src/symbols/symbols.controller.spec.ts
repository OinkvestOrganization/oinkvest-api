import { Test, TestingModule } from '@nestjs/testing';
import { SymbolsController } from './symbols.controller';
import { SymbolsService } from './symbols.service';
import { BinanceExchangeInfo } from './dto/binance-exchange-info.dto';

const mockSymbols: BinanceExchangeInfo = {
  symbols: [
    {
      symbol: 'BTCUSDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      permissions: ['SPOT'],
      status: 'TRADING',
    },
    {
      symbol: 'ETHUSDT',
      baseAsset: 'ETH',
      quoteAsset: 'USDT',
      permissions: ['SPOT'],
      status: 'TRADING',
    },
  ],
};

describe('SymbolsController', () => {
  let controller: SymbolsController;
  let service: SymbolsService;

  const symbolsServiceMock = {
    searchPair: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SymbolsController],
      providers: [
        {
          provide: SymbolsService,
          useValue: symbolsServiceMock,
        },
      ],
    }).compile();

    controller = module.get<SymbolsController>(SymbolsController);
    service = module.get<SymbolsService>(SymbolsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getSymbols', () => {
    it('should call searchPair with no params when no partialSymbol is provided', async () => {
      symbolsServiceMock.searchPair.mockResolvedValue(mockSymbols);

      const result = await controller.getSymbols();

      expect(service.searchPair).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(mockSymbols);
    });

    it('should call searchPair with the partialSymbol', async () => {
      const searchTerm = 'BTC';
      const mockResult: BinanceExchangeInfo = {
        symbols: [
          {
            symbol: 'BTCUSDT',
            baseAsset: 'BTC',
            quoteAsset: 'USDT',
            permissions: ['SPOT'],
            status: 'TRADING',
          },
        ],
      };
      symbolsServiceMock.searchPair.mockResolvedValue(mockResult);

      const result = await controller.getSymbols(searchTerm);

      expect(service.searchPair).toHaveBeenCalledWith(searchTerm);
      expect(result).toEqual(mockResult);
    });

    it('should handle the case where searchPair returns an empty list', async () => {
      const searchTerm = 'NOMATCH';
      const mockResult: BinanceExchangeInfo = { symbols: [] };
      symbolsServiceMock.searchPair.mockResolvedValue(mockResult);

      const result = await controller.getSymbols(searchTerm);

      expect(service.searchPair).toHaveBeenCalledWith(searchTerm);
      expect(result).toEqual(mockResult);
    });
  });
});
