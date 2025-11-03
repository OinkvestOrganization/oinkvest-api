import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { KlineHistoryService } from '../src/kline-server/kline-history.service';
import { BinanceStreamClientService } from '../src/binance-stream-client/binance-stream-client.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { io, Socket } from 'socket.io-client';
import { PrismaService } from '../src/prisma/prisma.service';
import { EmailService } from '../src/email/email.service';
import cookieParser from 'cookie-parser';

// Mocks
const mockKlineHistoryService = {
  getHistory: jest.fn(),
};

const mockBinanceStreamClientService = {
  subscribeToStream: jest.fn(),
  unsubscribeFromStream: jest.fn(),
};

const mockEmailService = {
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
};

describe('Kline E2E (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let eventEmitter: EventEmitter2;
  let socketClient: Socket;
  let accessTokenCookie: string;
  let serverUrl: string;

  const mockUser = {
    email: 'kline-e2e-test@example.com',
    nome: 'Kline E2E User',
    senha: 'Password@123',
  };

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

  const mockRealTimeData = {
    e: 'kline',
    s: 'BTCUSDT',
    k: { c: '16501.00' },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(KlineHistoryService)
      .useValue(mockKlineHistoryService)
      .overrideProvider(BinanceStreamClientService)
      .useValue(mockBinanceStreamClientService)
      .overrideProvider(EmailService)
      .useValue(mockEmailService)
      .compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    app.use(cookieParser());
    prismaService = app.get<PrismaService>(PrismaService);
    eventEmitter = app.get<EventEmitter2>(EventEmitter2);
    await app.init();

    await app.listen(0);

    const address = app.getHttpServer().address();
    const port = address.port;
    serverUrl = `http://localhost:${port}`;
  });

  beforeEach(async () => {
    // Limpar o Banco e Configurar Usuário
    await prismaService.user.deleteMany();
    await prismaService.verificationToken.deleteMany();

    // Registrar e Verificar (para garantir que o login funcione)
    await request(app.getHttpServer()).post('/auth/register').send(mockUser);
    const tokenRecord = await prismaService.verificationToken.findFirst({
      where: { user: { email: mockUser.email } },
    });
    await request(app.getHttpServer())
      .post('/auth/verify')
      .query({ token: tokenRecord.token });

    // Login para obter o cookie
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: mockUser.email, senha: mockUser.senha });

    accessTokenCookie = loginResponse.headers['set-cookie'][0];

    // Limpar mocks
    jest.clearAllMocks();
    mockEmailService.sendVerificationEmail.mockClear();
  });

  afterAll(async () => {
    if (socketClient) {
      socketClient.disconnect();
    }
    await app.close();
  });

  it('Conexão, Inscrição e Recebimento de Klines (Fluxo WebSocket)', async () => {
    // Mock do histórico
    mockKlineHistoryService.getHistory.mockResolvedValue(mockKlineData);

    // Criamos uma Promise para "ouvir" o histórico
    const historyPromise = new Promise((resolve, reject) => {
      socketClient = io(serverUrl, {
        extraHeaders: {
          Cookie: accessTokenCookie,
        },
        transports: ['websocket'],
      });

      socketClient.on('connect', () => {
        // 5. emit('klines') (Inscrição)
        socketClient.emit('klines', {
          symbol: 'BTCUSDT',
          interval: '1m',
          limit: 5,
        });
      });

      // 1. Ouvir Evento de Klines
      socketClient.on('klines', (data) => {
        // Esta é a primeira mensagem (histórico)
        resolve(data);
      });

      socketClient.on('error', (err) => reject(err as Error));
      socketClient.on('disconnect', () =>
        reject(new Error('Socket disconnected early')),
      );
    });

    // 2. Assert (Histórico) - Espera o histórico chegar
    await expect(historyPromise).resolves.toEqual(mockKlineData);

    // 3. Agora, crie uma Promise para o dado em tempo real
    const realTimePromise = new Promise((resolve) => {
      socketClient.on('klines', (data) => {
        // Esta é a segunda mensagem (tempo real)
        resolve(data);
      });
    });

    // 4. Simular a Binance enviando um dado
    eventEmitter.emit('binance.stream.btcusdt@kline_1m', {
      stream: 'btcusdt@kline_1m',
      data: mockRealTimeData,
    });

    // 5. Assert (Tempo Real)
    await expect(realTimePromise).resolves.toEqual(mockRealTimeData);

    // Limpeza
    socketClient.disconnect();
  });
});
