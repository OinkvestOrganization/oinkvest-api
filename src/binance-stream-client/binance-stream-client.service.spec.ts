import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BinanceStreamClientService } from './binance-stream-client.service';
import { WebSocket } from 'ws';

// Mock do módulo 'ws'
jest.mock('ws', () => {
  const actualWs = jest.requireActual('ws');
  const RealWebSocket = actualWs.WebSocket;
  const mockWsConstructor = jest.fn().mockImplementation((url) => {
    const wsInstance = {
      url,
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
      readyState: 0, // CONNECTING
      send: jest.fn(),
      close: jest.fn(),
      // Simula o estado do WebSocket
      _simulateOpen: function () {
        this.readyState = 1;
        if (this.onopen) this.onopen();
      },
      _simulateMessage: function (data: any) {
        if (this.onmessage) this.onmessage({ data: JSON.stringify(data) });
      },
      _simulateClose: function () {
        this.readyState = 3; // CLOSED
        if (this.onclose) this.onclose();
      },
      _simulateError: function (error: any) {
        if (this.onerror) this.onerror(error);
      },
    };
    // Simula a abertura da conexão após um micro-tick
    setTimeout(() => wsInstance._simulateOpen(), 0);
    return wsInstance;
  });

  Object.assign(mockWsConstructor, RealWebSocket);

  return {
    ...actualWs,
    WebSocket: mockWsConstructor,
  };
});

describe('BinanceStreamClientService', () => {
  let service: BinanceStreamClientService;
  let eventEmitter: EventEmitter2;
  let mockWsInstance: any;

  beforeEach(async () => {
    jest.useFakeTimers();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BinanceStreamClientService,
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BinanceStreamClientService>(
      BinanceStreamClientService,
    );
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);

    (service as any).onModuleInit();

    jest.advanceTimersByTime(0);

    // Captura a instância mockada do WebSocket criada durante o onModuleInit
    mockWsInstance = (WebSocket as jest.Mock).mock.results[0].value;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('deve ser definido', () => {
    expect(service).toBeDefined();
  });

  it('deve conectar ao WebSocket da Binance no onModuleInit', () => {
    expect(WebSocket).toHaveBeenCalledWith('wss://stream.binance.com:9443/ws');
    expect(mockWsInstance.onopen).toBeInstanceOf(Function);
    expect(mockWsInstance.onmessage).toBeInstanceOf(Function);
    expect(mockWsInstance.onclose).toBeInstanceOf(Function);
    expect(mockWsInstance.onerror).toBeInstanceOf(Function);
  });

  describe('Manipulação de Mensagens', () => {
    it('deve emitir um evento para dados de kline recebidos', () => {
      const klineData = {
        e: 'kline',
        E: 1672531200000,
        s: 'BTCUSDT',
        k: {
          t: 1672531200000,
          T: 1672531259999,
          s: 'BTCUSDT',
          i: '1m',
          f: 100,
          L: 200,
          o: '16500.00',
          c: '16501.00',
          h: '16502.00',
          l: '16499.00',
          v: '10.00',
          n: 10,
          x: false,
          q: '165000.00',
          V: '5.00',
          Q: '82500.00',
          B: '0',
        },
      };

      mockWsInstance._simulateMessage(klineData);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'binance.stream.btcusdt@kline_1m',
        {
          stream: 'btcusdt@kline_1m',
          data: klineData,
        },
      );
    });

    it('não deve emitir evento se a mensagem não for kline', () => {
      const nonKlineData = {
        e: '24hrTicker',
        E: 1672531200000,
        s: 'BTCUSDT',
      };

      mockWsInstance._simulateMessage(nonKlineData);

      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('Reconexão e Erros', () => {
    it('deve tentar reconectar após o fechamento da conexão', () => {
      mockWsInstance._simulateClose();

      // Avança o timer para simular o setTimeout
      jest.advanceTimersByTime(1000);

      // A mock do WebSocket deve ter sido chamada novamente para a reconexão
      expect(WebSocket).toHaveBeenCalledTimes(2);
    });

    it('deve registrar erro no console em caso de erro do WebSocket', () => {
      const loggerErrorSpy = jest.spyOn((service as any).logger, 'error');
      const mockError = { message: 'Connection refused' };

      mockWsInstance._simulateError(mockError);

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Binance WebSocket error:',
        mockError,
      );
    });
  });

  describe('Inscrição e Cancelamento de Inscrição', () => {
    const streamName = 'btcusdt@kline_1m';

    it('deve se inscrever em um novo stream e enviar a mensagem SUBSCRIBE', () => {
      service.subscribeToStream(streamName);

      expect(mockWsInstance.send).toHaveBeenCalledWith(
        JSON.stringify({
          method: 'SUBSCRIBE',
          params: [streamName],
          id: 1,
        }),
      );
      // Verifica se o stream foi adicionado ao pool
      expect((service as any).streamPool.has(streamName)).toBe(true);
    });

    it('não deve se inscrever novamente se já estiver inscrito', () => {
      // Primeira inscrição
      service.subscribeToStream(streamName);
      mockWsInstance.send.mockClear(); // Limpa o mock para contar apenas a SUBSCRIBE

      // Segunda inscrição
      service.subscribeToStream(streamName);
      expect(mockWsInstance.send).toHaveBeenCalledTimes(0); // Não deve chamar send novamente
    });

    it('deve cancelar a inscrição de um stream e enviar a mensagem UNSUBSCRIBE', () => {
      // Primeiro se inscreve
      service.subscribeToStream(streamName);
      mockWsInstance.send.mockClear(); // Limpa o mock para contar apenas o UNSUBSCRIBE

      // Cancela a inscrição
      service.unsubscribeFromStream(streamName);

      expect(mockWsInstance.send).toHaveBeenCalledWith(
        JSON.stringify({
          method: 'UNSUBSCRIBE',
          params: [streamName],
          id: 1,
        }),
      );
      // Verifica se o stream foi removido do pool
      expect((service as any).streamPool.has(streamName)).toBe(false);
    });

    it('não deve tentar cancelar a inscrição se o stream não estiver no pool', () => {
      service.unsubscribeFromStream(streamName);

      expect(mockWsInstance.send).not.toHaveBeenCalled();
    });

    it('deve lidar com erro durante a inscrição (ex: erro no send)', () => {
      const loggerErrorSpy = jest.spyOn((service as any).logger, 'error');
      const mockError = new Error('WebSocket is not open');

      mockWsInstance.send.mockImplementationOnce(() => {
        throw mockError;
      });

      service.subscribeToStream(streamName);

      expect(loggerErrorSpy).toHaveBeenCalledWith(mockError.message);
      expect(mockWsInstance.send).toHaveBeenCalled();
      expect((service as any).streamPool.has(streamName)).toBe(false);
    });

    it('deve retornar o status correto do cliente de stream', () => {
      const streamName2 = 'ethusdt@kline_1m';
      service.subscribeToStream(streamName);
      service.subscribeToStream(streamName2);

      const status = service.streamClientStatus();

      expect(status.streamPool).toEqual({
        [streamName]: 'subscribed',
        [streamName2]: 'subscribed',
      });
    });
  });
});
