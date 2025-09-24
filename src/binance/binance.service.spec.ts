import { Test, TestingModule } from '@nestjs/testing';
import { BinanceService } from './binance.service';

describe('BinanceService', () => {
  let service: BinanceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BinanceService],
    }).compile();

    service = module.get<BinanceService>(BinanceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // Teste manual - descomente para testar a conexão WebSocket
  // it('should connect to Binance WebSocket and receive ticker data', async () => {
  //   const symbol = 'btcusdt';
  //   let receivedData = false;
  //
  //   await service.subscribeTicker(symbol, (data) => {
  //     console.log('Ticker data received:', data);
  //     receivedData = true;
  //   });
  //
  //   // Aguarda 5 segundos para receber dados
  //   await new Promise(resolve => setTimeout(resolve, 5000));
  //   expect(receivedData).toBe(true);
  // }, 10000);
});