import { Test, TestingModule } from '@nestjs/testing';
import { KlineServerService } from './kline-server.service';
import { BinanceStreamClientService } from '../binance-stream-client/binance-stream-client.service';
import { KlineHistoryService } from './kline-history.service';
import { Server, Socket } from 'socket.io';
import KlineSubscriptionDto from './dto/klineSubscription.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Mocks
const mockBinanceStreamClientService = {
  subscribeToStream: jest.fn(),
  unsubscribeFromStream: jest.fn(),
};

const mockKlineHistoryService = {
  getHistory: jest.fn(),
};

const mockSocket = {
  id: 'client1',
  emit: jest.fn(),
} as unknown as Socket;

const mockServer = {
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
  engine: {
    clientsCount: 5,
  },
} as unknown as Server;

describe('KlineServerService', () => {
  let service: KlineServerService;
  let binanceStreamClient: BinanceStreamClientService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KlineServerService,
        {
          provide: BinanceStreamClientService,
          useValue: mockBinanceStreamClientService,
        },
        {
          provide: KlineHistoryService,
          useValue: mockKlineHistoryService,
        },
        // O EventEmitter2 é necessário para o @OnEvent funcionar
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<KlineServerService>(KlineServerService);
    binanceStreamClient = module.get<BinanceStreamClientService>(
      BinanceStreamClientService,
    );

    // Configura o mock do servidor
    service.setServer(mockServer);
    // Limpa os mocks antes de cada teste
    jest.clearAllMocks();
  });

  it('deve ser definido', () => {
    expect(service).toBeDefined();
  });

  describe('handleKlineSubscription', () => {
    const subscriptionData: KlineSubscriptionDto = {
      symbol: 'BTCUSDT',
      interval: '1m',
      limit: 10,
    };
    const streamName = 'btcusdt@kline_1m';

    it('deve inscrever o cliente e o stream na Binance se for o primeiro', async () => {
      await service.handleKlineSubscription(mockSocket, subscriptionData);

      // 1. Deve adicionar o stream ao pool de inscritos
      expect(
        (service as any).streamSubscribers.get(streamName).has(mockSocket.id),
      ).toBe(true);
      // 2. Deve inscrever na Binance
      expect(binanceStreamClient.subscribeToStream).toHaveBeenCalledWith(
        streamName,
      );
      // 3. Não deve emitir klines (histórico está comentado)
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    it('deve inscrever o cliente, mas não o stream na Binance se já houver outro inscrito', async () => {
      // Simula um cliente já inscrito
      (service as any).streamSubscribers.set(streamName, new Set(['client0']));

      await service.handleKlineSubscription(mockSocket, subscriptionData);

      // 1. Deve adicionar o novo cliente ao pool
      expect(
        (service as any).streamSubscribers.get(streamName).has(mockSocket.id),
      ).toBe(true);
      // 2. NÃO deve inscrever na Binance novamente
      expect(binanceStreamClient.subscribeToStream).not.toHaveBeenCalled();
    });

    it('deve emitir erro se o payload for JSON inválido (caso de erro)', async () => {
      const invalidData = '{"symbol": "BTCUSDT", "interval": "1m"'; // JSON inválido
      await service.handleKlineSubscription(mockSocket, invalidData as any);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'error',
        'Invalid data format',
      );
      expect(binanceStreamClient.subscribeToStream).not.toHaveBeenCalled();
    });
  });

  describe('handleKlineUnsubscription', () => {
    const subscriptionData: KlineSubscriptionDto = {
      symbol: 'BTCUSDT',
      interval: '1m',
      limit: 10,
    };
    const streamName = 'btcusdt@kline_1m';

    beforeEach(() => {
      // Prepara o estado: cliente inscrito
      (service as any).streamSubscribers.set(
        streamName,
        new Set([mockSocket.id, 'client2']),
      );
    });

    it('deve desinscrever o cliente, mas manter o stream na Binance se houver outros clientes', () => {
      service.handleKlineUnsubscription(mockSocket, subscriptionData);

      // 1. Deve remover o cliente do pool
      expect(
        (service as any).streamSubscribers.get(streamName).has(mockSocket.id),
      ).toBe(false);
      // 2. NÃO deve desinscrever na Binance
      expect(binanceStreamClient.unsubscribeFromStream).not.toHaveBeenCalled();
      // 3. Deve notificar o cliente
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'klines',
        `Inscrição removida do stream: ${streamName}`,
      );
    });

    it('deve desinscrever o cliente e o stream na Binance se for o último cliente', () => {
      // Prepara o estado: apenas o mockSocket inscrito
      (service as any).streamSubscribers.set(
        streamName,
        new Set([mockSocket.id]),
      );

      service.handleKlineUnsubscription(mockSocket, subscriptionData);

      // 1. Deve remover o stream do pool
      expect((service as any).streamSubscribers.has(streamName)).toBe(false);
      // 2. Deve desinscrever na Binance
      expect(binanceStreamClient.unsubscribeFromStream).toHaveBeenCalledWith(
        streamName,
      );
    });
  });

  describe('handleBinanceStream', () => {
    const streamName = 'btcusdt@kline_1m';
    const mockData = {
      e: 'kline',
      s: 'BTCUSDT',
      k: { c: '16501.00' },
    };
    const payload = { stream: streamName, data: mockData };

    beforeEach(() => {
      // Prepara o estado: dois clientes inscritos
      (service as any).streamSubscribers.set(
        streamName,
        new Set([mockSocket.id, 'client2']),
      );
    });

    it('deve emitir os dados recebidos para todos os clientes inscritos', () => {
      // Chama o método que é acionado pelo @OnEvent
      service.handleBinanceStream(payload);

      // Deve chamar o 'to' para cada cliente inscrito
      expect(mockServer.to).toHaveBeenCalledWith(mockSocket.id);
      expect(mockServer.to).toHaveBeenCalledWith('client2');

      // Deve emitir os dados brutos da Binance
      expect(mockServer.emit).toHaveBeenCalledWith('klines', mockData);
      // O emit é chamado duas vezes (uma para cada cliente)
      expect(mockServer.emit).toHaveBeenCalledTimes(2);
    });

    it('não deve emitir se não houver clientes inscritos para o stream', () => {
      const unknownStream = 'ethusdt@kline_1m';
      const unknownPayload = { stream: unknownStream, data: mockData };

      service.handleBinanceStream(unknownPayload);

      expect(mockServer.to).not.toHaveBeenCalled();
      expect(mockServer.emit).not.toHaveBeenCalled();
    });
  });

  describe('getConnectionsStatus', () => {
    it('deve retornar o status correto das conexões e streams', () => {
      const streamName1 = 'btcusdt@kline_1m';
      const streamName2 = 'ethusdt@kline_5m';

      // Prepara o estado
      (service as any).streamSubscribers.set(
        streamName1,
        new Set(['client1', 'client2']),
      );
      (service as any).streamSubscribers.set(streamName2, new Set(['client3']));

      const status = service.getConnectionsStatus();

      expect(status.totalConnections).toBe(mockServer.engine.clientsCount);
      expect(status.activeStreamsCount).toBe(2);
      expect(status.activeStreams[streamName1].subscriberCount).toBe(2);
      expect(status.activeStreams[streamName1].subscribers).toEqual([
        'client1',
        'client2',
      ]);
      expect(status.activeStreams[streamName2].subscriberCount).toBe(1);
      expect(status.activeStreams[streamName2].subscribers).toEqual([
        'client3',
      ]);
    });
  });
});
