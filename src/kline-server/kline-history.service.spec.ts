import { Test, TestingModule } from '@nestjs/testing';
import { KlineHistoryService } from './kline-history.service';
import { WebSocket } from 'ws';

// Mock do módulo 'ws' para simular a conexão e as mensagens
jest.mock('ws', () => {
  const actualWs = jest.requireActual('ws');
  const RealWebSocket = actualWs.WebSocket;

  const mockWsConstructor = jest.fn().mockImplementation((url) => {
    const wsInstance = {
      url,
      on: jest.fn((event, callback) => {
        if (event === 'open') {
          // Simula a abertura da conexão após um micro-tick
          setTimeout(() => {
            wsInstance.readyState = 1; // OPEN
            callback();
          }, 0);
        }
        if (event === 'message') {
          // Guarda o callback para simular mensagens depois
          (global as any).mockWsMessageCallback = callback;
        }
        if (event === 'error') {
          (global as any).mockWsErrorCallback = callback;
        }
      }),
      readyState: 0, // CONNECTING
      send: jest.fn(),
      close: jest.fn(),
    };
    return wsInstance;
  });

  Object.assign(mockWsConstructor, RealWebSocket);

  return {
    ...actualWs, // Mantém estáticos como .OPEN, .CLOSED, etc.
    WebSocket: mockWsConstructor, // Substitui o construtor
  };
});

// Função auxiliar para simular a resposta da Binance
const simulateBinanceResponse = (id: string, result: any) => {
  if ((global as any).mockWsMessageCallback) {
    const message = JSON.stringify({ id, result });
    (global as any).mockWsMessageCallback(Buffer.from(message));
  }
};

describe('KlineHistoryService', () => {
  let service: KlineHistoryService;
  let mockWsInstance: any;

  beforeEach(async () => {
    jest.useFakeTimers();
    const module: TestingModule = await Test.createTestingModule({
      providers: [KlineHistoryService],
    }).compile();

    service = module.get<KlineHistoryService>(KlineHistoryService);

    jest.advanceTimersByTime(0);

    mockWsInstance = (WebSocket as unknown as jest.Mock).mock.results[0].value;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('deve ser definido', () => {
    expect(service).toBeDefined();
  });

  it('deve conectar ao WebSocket da Binance API no construtor', () => {
    expect(WebSocket).toHaveBeenCalledWith(
      'wss://ws-api.binance.com:9443/ws-api/v3',
    );
    expect(mockWsInstance.on).toHaveBeenCalledWith(
      'open',
      expect.any(Function),
    );
    expect(mockWsInstance.on).toHaveBeenCalledWith(
      'message',
      expect.any(Function),
    );
    expect(mockWsInstance.on).toHaveBeenCalledWith(
      'error',
      expect.any(Function),
    );
  });

  describe('getHistory', () => {
    const symbol = 'BTCUSDT';
    const interval = '1m';
    const limit = 5;
    const mockKlineData = [
      [
        1672531200000,
        '16500.00',
        '16502.00',
        '16499.00',
        '16501.00',
        '10.00',
        1672531259999,
        '165000.00',
        10,
        '5.00',
        '82500.00',
        '0',
      ],
    ];

    it('deve enviar a requisição correta e resolver a promessa com os dados', async () => {
      // simula a abertura da conexão
      jest.advanceTimersByTime(0);
      const promise = service.getHistory(symbol, interval, limit);

      // Captura o ID da requisição enviada
      const sentMessage = JSON.parse(mockWsInstance.send.mock.calls[0][0]);
      const requestId = sentMessage.id;

      expect(mockWsInstance.send).toHaveBeenCalledTimes(1);
      expect(sentMessage.method).toBe('klines');
      expect(sentMessage.params).toEqual({
        symbol: symbol,
        interval: interval,
        limit: limit,
      });

      // Simula a resposta da Binance
      simulateBinanceResponse(requestId, mockKlineData);

      await expect(promise).resolves.toEqual(mockKlineData);

      // Verifica se a requisição pendente foi removida
      expect((service as any).pendingRequests.has(requestId)).toBe(false);
    });

    it('deve rejeitar a promessa se a conexão WebSocket não estiver aberta (caso de erro)', async () => {
      // Simula a conexão não aberta
      mockWsInstance.readyState = 0; // CONNECTING

      await expect(service.getHistory(symbol, interval, limit)).rejects.toThrow(
        'WebSocket connection not open',
      );

      expect(mockWsInstance.send).not.toHaveBeenCalled();
    });

    it('deve rejeitar a promessa se a requisição expirar (caso de erro - API indisponível/lenta)', async () => {
      // simula a abertura da conexão
      jest.advanceTimersByTime(0);

      const promise = service.getHistory(symbol, interval, limit);

      // Captura o ID da requisição enviada
      const sentMessage = JSON.parse(mockWsInstance.send.mock.calls[0][0]);
      const requestId = sentMessage.id;

      // Avança o timer para simular o timeout (10000ms)
      jest.advanceTimersByTime(10000);

      await expect(promise).rejects.toThrow('Request timed out');

      // Verifica se a requisição pendente foi removida
      expect((service as any).pendingRequests.has(requestId)).toBe(false);
    });

    it('deve lidar com erro de conexão (caso de erro)', () => {
      const loggerErrorSpy = jest.spyOn((service as any).logger, 'error');
      const mockError = new Error('Connection error');

      // Simula o erro de conexão
      if ((global as any).mockWsErrorCallback) {
        (global as any).mockWsErrorCallback(mockError);
      }

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Binance WebSocket error:',
        mockError,
      );
    });
  });
});
