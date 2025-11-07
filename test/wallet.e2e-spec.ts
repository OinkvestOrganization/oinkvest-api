import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { BinanceSpotClientService } from '@/binance/binance-rest-client.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { WalletModule } from 'src/wallet/wallet.module';

import { BinanceClientStub } from './stubs/binance.client.stub';
import { JwtAuthGuardStub } from './stubs/jwt.guard.stub';
import { createPrismaStub } from './stubs/prisma.stub';

describe('Wallet E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [WalletModule],
    })
      .overrideProvider(PrismaService)
      .useValue(createPrismaStub())
      .overrideProvider(BinanceSpotClientService)
      .useValue(BinanceClientStub)
      .overrideGuard(JwtAuthGuard)
      .useClass(JwtAuthGuardStub)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /wallet/credentials — salva credenciais (sem vazar secrets)', async () => {
    const res = await request(app.getHttpServer())
      .post('/wallet/credentials')
      .send({ apiKey: 'AK_TEST', apiSecret: 'SK_TEST' })
      .expect(201);

    expect(res.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        userId: 'user_test_123',
        exchange: 'BINANCE',
        status: 'ACTIVE',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      }),
    );
    // não deve conter secrets
    expect(res.body.apiKey).toBeUndefined();
    expect(res.body.apiSecret).toBeUndefined();
  });

  it('GET /wallet/credentials — retorna metadados (sem secrets)', async () => {
    const res = await request(app.getHttpServer())
      .get('/wallet/credentials')
      .expect(200);

    expect(res.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        exchange: 'BINANCE',
        status: 'ACTIVE',
      }),
    );
    expect(res.body.apiKey).toBeUndefined();
    expect(res.body.apiSecret).toBeUndefined();
  });

  it('GET /wallet/binance/balances — lê direto da Binance (stub) e filtra total > 0', async () => {
    const res = await request(app.getHttpServer())
      .get('/wallet/binance/balances')
      .expect(200);

    // XYZ deve ser filtrado
    const assets = res.body.map((b: any) => b.asset);
    expect(assets).toContain('USDT');
    expect(assets).toContain('BTC');
    expect(assets).not.toContain('XYZ');
  });

  it('POST /wallet/sync/balances — persiste saldos em WalletBalance e cria log', async () => {
    const res = await request(app.getHttpServer())
      .post('/wallet/sync/balances')
      .expect(201)
      .catch(() =>
        request(app.getHttpServer()).post('/wallet/sync/balances').expect(200),
      ); // compat 200/201

    expect(res.body).toEqual(
      expect.objectContaining({ updated: expect.any(Number) }),
    );
    expect(res.body.updated).toBeGreaterThanOrEqual(2);
  });

  it('GET /wallet/balances — lista persistidos e aceita filtros opcionais', async () => {
    // sem filtros
    const resAll = await request(app.getHttpServer())
      .get('/wallet/balances')
      .expect(200);

    expect(Array.isArray(resAll.body)).toBe(true);
    expect(resAll.body.length).toBeGreaterThanOrEqual(2);

    // com asset
    const resBtc = await request(app.getHttpServer())
      .get('/wallet/balances?asset=BTC')
      .expect(200);

    expect(resBtc.body.every((b: any) => b.asset === 'BTC')).toBe(true);

    // com minTotal
    const resMin = await request(app.getHttpServer())
      .get('/wallet/balances?minTotal=50')
      .expect(200);

    // USDT(100) deve aparecer, BTC(0.002) não
    const assets = resMin.body.map((b: any) => b.asset);
    expect(assets).toContain('USDT');
    expect(assets).not.toContain('BTC');
  });
});
