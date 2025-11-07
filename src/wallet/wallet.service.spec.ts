import { Test, TestingModule } from '@nestjs/testing';
import { WalletService } from './wallet.service';
import { PrismaService } from '@/prisma/prisma.service';
import { BinanceSpotClientService } from '@/binance/binance-rest-client.service';

const mockPrismaService = {};

const mockBinanceSpotClientService = {};

describe('WalletService', () => {
  let service: WalletService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: PrismaService, useValue: mockPrismaService },
        {
          provide: BinanceSpotClientService,
          useValue: mockBinanceSpotClientService,
        },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
