# 💻 EXEMPLOS DE CÓDIGO - MÓDULO TRADE

## 1️⃣ DTO: Colocar Ordem

### `src/trade/dto/place-order.dto.ts`

```typescript
import { IsString, IsDecimal, IsEnum, IsOptional, Matches } from 'class-validator';

export enum OrderSide {
  BUY = 'BUY',
  SELL = 'SELL',
}

export enum OrderType {
  LIMIT = 'LIMIT',
  MARKET = 'MARKET',
  STOP_LOSS = 'STOP_LOSS',
  STOP_LOSS_LIMIT = 'STOP_LOSS_LIMIT',
  TAKE_PROFIT = 'TAKE_PROFIT',
  TAKE_PROFIT_LIMIT = 'TAKE_PROFIT_LIMIT',
  LIMIT_MAKER = 'LIMIT_MAKER',
}

export enum TimeInForce {
  GTC = 'GTC', // Good-Till-Cancel
  IOC = 'IOC', // Immediate-Or-Cancel
  FOK = 'FOK', // Fill-Or-Kill
}

export class PlaceOrderDto {
  @IsString()
  @Matches(/^[A-Z]{6,10}$/, {
    message: 'Symbol must be uppercase (e.g., BTCUSDT)',
  })
  symbol: string;

  @IsEnum(OrderSide)
  side: OrderSide;

  @IsEnum(OrderType)
  type: OrderType;

  @IsOptional()
  @IsDecimal({ decimal_digits: '1,8' })
  quantity?: string;

  @IsOptional()
  @IsDecimal({ decimal_digits: '1,8' })
  quoteOrderQty?: string;

  @IsOptional()
  @IsDecimal({ decimal_digits: '1,8' })
  price?: string;

  @IsOptional()
  @IsDecimal({ decimal_digits: '1,8' })
  stopPrice?: string;

  @IsOptional()
  @IsEnum(TimeInForce)
  timeInForce?: TimeInForce = TimeInForce.GTC;
}
```

---

## 2️⃣ TradeService: Colocar Ordem

### `src/trade/trade.service.ts` (Trecho)

```typescript
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { BinanceRestClientService } from '@/binance/binance-rest-client.service';
import { CryptoUtil } from '@/common/utils/crypto.util';
import { PlaceOrderDto } from './dto/place-order.dto';

@Injectable()
export class TradeService {
  private readonly logger = new Logger(TradeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly binanceClient: BinanceRestClientService,
  ) {}

  /**
   * Coloca uma nova ordem de compra/venda na Binance
   */
  async placeOrder(userId: string, dto: PlaceOrderDto) {
    // 1️⃣ VALIDAÇÃO: Usuário tem credenciais?
    const credentials = await this.prisma.exchangeCredential.findUnique({
      where: { userId_exchange: { userId, exchange: 'BINANCE' } },
    });

    if (!credentials) {
      throw new NotFoundException(
        'Binance credentials not found. Please save your API keys first.',
      );
    }

    if (credentials.status !== 'ACTIVE') {
      throw new BadRequestException('Binance credentials are not active');
    }

    // 2️⃣ VALIDAÇÃO: Quantidade ou quoteOrderQty?
    if (!dto.quantity && !dto.quoteOrderQty) {
      throw new BadRequestException(
        'Either quantity or quoteOrderQty must be provided',
      );
    }

    if (dto.quantity && dto.quoteOrderQty) {
      throw new BadRequestException(
        'Cannot send both quantity and quoteOrderQty',
      );
    }

    // 3️⃣ VALIDAÇÃO: Preço obrigatório para LIMIT
    if (dto.type === 'LIMIT' && !dto.price) {
      throw new BadRequestException('Price is required for LIMIT orders');
    }

    // 4️⃣ DESCRIPTOGRAFAR credenciais
    const apiKey = CryptoUtil.decrypt(credentials.apiKey);
    const apiSecret = CryptoUtil.decrypt(credentials.apiSecret);

    // 5️⃣ PREPARAR parâmetros para Binance
    const binanceParams = {
      symbol: dto.symbol,
      side: dto.side,
      type: dto.type,
      quantity: dto.quantity,
      quoteOrderQty: dto.quoteOrderQty,
      price: dto.price,
      stopPrice: dto.stopPrice,
      timeInForce: dto.timeInForce,
      newOrderRespType: 'FULL', // Resposta detalhada
    };

    // Remove undefined values
    Object.keys(binanceParams).forEach(
      (key) => binanceParams[key] === undefined && delete binanceParams[key],
    );

    try {
      // 6️⃣ CHAMAR Binance API
      this.logger.log(`Placing order: ${JSON.stringify(binanceParams)}`);

      const binanceResponse = await this.binanceClient.signedPost(
        '/api/v3/order',
        apiKey,
        apiSecret,
        binanceParams,
      );

      // 7️⃣ PERSISTIR em transação
      const result = await this.prisma.$transaction(async (tx) => {
        // Criar registro de order
        const order = await tx.order.create({
          data: {
            userId,
            orderId: binanceResponse.orderId,
            clientOrderId: binanceResponse.clientOrderId,
            symbol: binanceResponse.symbol,
            side: binanceResponse.side,
            type: binanceResponse.type,
            status: binanceResponse.status,
            quantity: binanceResponse.origQty,
            executedQty: binanceResponse.executedQty || '0',
            price: binanceResponse.price || '0',
            stopPrice: binanceResponse.stopPrice,
            transactTime: new Date(binanceResponse.transactTime),
          },
        });

        // Log da ação
        await tx.orderLog.create({
          data: {
            userId,
            orderId: binanceResponse.orderId,
            action: 'PLACE',
            status: 'SUCCESS',
            message: `Order placed successfully`,
            responseData: binanceResponse,
          },
        });

        // Se a ordem veio com trades (MARKET order), sincronizar
        if (binanceResponse.fills && binanceResponse.fills.length > 0) {
          await this.syncTradesFromFills(tx, userId, binanceResponse.fills);
        }

        return order;
      });

      this.logger.log(
        `Order placed successfully: orderId=${result.orderId}`,
      );

      return {
        orderId: result.orderId,
        clientOrderId: result.clientOrderId,
        symbol: result.symbol,
        side: result.side,
        type: result.type,
        status: result.status,
        quantity: result.quantity,
        executedQty: result.executedQty,
        price: result.price,
        transactTime: result.transactTime,
      };
    } catch (error) {
      // 8️⃣ TRATAR erros
      this.logger.error(`Failed to place order: ${error.message}`, error);

      // Log de erro
      await this.prisma.orderLog.create({
        data: {
          userId,
          orderId: null,
          action: 'PLACE',
          status: 'FAILURE',
          message: error.message,
          requestData: binanceParams,
          responseData: error.response?.data,
        },
      });

      throw new BadRequestException(
        `Binance API error: ${error.message}`,
      );
    }
  }

  /**
   * Sincronizar trades do response de MARKET order
   */
  private async syncTradesFromFills(tx, userId: string, fills: any[]) {
    for (const fill of fills) {
      await tx.trade.upsert({
        where: {
          userId_tradeId: {
            userId,
            tradeId: BigInt(fill.tradeId),
          },
        },
        create: {
          userId,
          tradeId: BigInt(fill.tradeId),
          orderId: BigInt(fill.orderId),
          symbol: fill.symbol,
          price: fill.price,
          quantity: fill.qty,
          quoteQuantity: fill.quoteQty,
          commission: fill.commission,
          commissionAsset: fill.commissionAsset,
          isBuyer: fill.isBuyer,
          isMaker: fill.isMaker,
          executedTime: new Date(),
        },
        update: {
          lastSyncAt: new Date(),
        },
      });
    }
  }

  /**
   * Cancelar uma ordem
   */
  async cancelOrder(userId: string, orderId: BigInt, symbol: string) {
    // Validações similares
    const credentials = await this.prisma.exchangeCredential.findUnique({
      where: { userId_exchange: { userId, exchange: 'BINANCE' } },
    });

    if (!credentials) {
      throw new NotFoundException('Binance credentials not found');
    }

    const apiKey = CryptoUtil.decrypt(credentials.apiKey);
    const apiSecret = CryptoUtil.decrypt(credentials.apiSecret);

    try {
      const binanceResponse = await this.binanceClient.signedDelete(
        '/api/v3/order',
        apiKey,
        apiSecret,
        {
          symbol,
          orderId: orderId.toString(),
        },
      );

      // Atualizar order no BD
      const order = await this.prisma.order.update({
        where: { userId_orderId: { userId, orderId } },
        data: {
          status: binanceResponse.status,
          updatedAt: new Date(),
        },
      });

      // Log
      await this.prisma.orderLog.create({
        data: {
          userId,
          orderId: orderId,
          action: 'CANCEL',
          status: 'SUCCESS',
          message: 'Order canceled',
          responseData: binanceResponse,
        },
      });

      return {
        orderId: order.orderId,
        status: order.status,
        canceledAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to cancel order: ${error.message}`);

      await this.prisma.orderLog.create({
        data: {
          userId,
          orderId,
          action: 'CANCEL',
          status: 'FAILURE',
          message: error.message,
        },
      });

      throw new BadRequestException(error.message);
    }
  }

  /**
   * Consultar status de uma ordem
   */
  async getOrderStatus(userId: string, orderId: BigInt, symbol: string) {
    const credentials = await this.prisma.exchangeCredential.findUnique({
      where: { userId_exchange: { userId, exchange: 'BINANCE' } },
    });

    if (!credentials) {
      throw new NotFoundException('Binance credentials not found');
    }

    const apiKey = CryptoUtil.decrypt(credentials.apiKey);
    const apiSecret = CryptoUtil.decrypt(credentials.apiSecret);

    try {
      const binanceResponse = await this.binanceClient.signedGet(
        '/api/v3/order',
        apiKey,
        apiSecret,
        {
          symbol,
          orderId: orderId.toString(),
        },
      );

      // Atualizar no BD
      await this.prisma.order.update({
        where: { userId_orderId: { userId, orderId } },
        data: {
          status: binanceResponse.status,
          executedQty: binanceResponse.executedQty,
          updatedAt: new Date(),
        },
      });

      return {
        orderId: binanceResponse.orderId,
        clientOrderId: binanceResponse.clientOrderId,
        symbol: binanceResponse.symbol,
        side: binanceResponse.side,
        type: binanceResponse.type,
        status: binanceResponse.status,
        quantity: binanceResponse.origQty,
        executedQty: binanceResponse.executedQty,
        price: binanceResponse.price,
        cumulativeQuoteQty: binanceResponse.cummulativeQuoteQty,
        createdAt: new Date(binanceResponse.time),
        updatedAt: new Date(),
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Listar ordens abertas
   */
  async getOpenOrders(userId: string, symbol?: string) {
    const credentials = await this.prisma.exchangeCredential.findUnique({
      where: { userId_exchange: { userId, exchange: 'BINANCE' } },
    });

    if (!credentials) {
      throw new NotFoundException('Binance credentials not found');
    }

    const apiKey = CryptoUtil.decrypt(credentials.apiKey);
    const apiSecret = CryptoUtil.decrypt(credentials.apiSecret);

    try {
      const params: any = {};
      if (symbol) params.symbol = symbol;

      const binanceResponse = await this.binanceClient.signedGet(
        '/api/v3/openOrders',
        apiKey,
        apiSecret,
        params,
      );

      return {
        total: binanceResponse.length,
        orders: binanceResponse.map((order) => ({
          orderId: order.orderId,
          clientOrderId: order.clientOrderId,
          symbol: order.symbol,
          side: order.side,
          type: order.type,
          status: order.status,
          quantity: order.origQty,
          executedQty: order.executedQty,
          price: order.price,
        })),
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
```

---

## 3️⃣ TradeController: Endpoints

### `src/trade/trade.controller.ts` (Trecho)

```typescript
import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiCreatedResponse } from '@nestjs/swagger';
import { TradeService } from './trade.service';
import { PlaceOrderDto } from './dto/place-order.dto';
import { JwtAuthGuard } from '@/auth/guard/jwt-auth.guard';

@ApiTags('Trade')
@ApiBearerAuth()
@Controller('trade')
@UseGuards(JwtAuthGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }),
)
export class TradeController {
  constructor(private readonly tradeService: TradeService) {}

  @ApiOperation({ summary: 'Place a new BUY or SELL order' })
  @ApiCreatedResponse({
    description: 'Order placed successfully',
    schema: {
      example: {
        orderId: 12345,
        clientOrderId: 'myOrder1',
        symbol: 'BTCUSDT',
        side: 'BUY',
        status: 'NEW',
        quantity: '0.001',
        executedQty: '0.000',
        price: '45000.00',
      },
    },
  })
  @Post('orders')
  @HttpCode(HttpStatus.CREATED)
  async placeOrder(@Req() req, @Body() dto: PlaceOrderDto) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    return this.tradeService.placeOrder(userId, dto);
  }

  @ApiOperation({ summary: 'Test order creation (without executing)' })
  @Post('orders/test')
  async testOrder(@Req() req, @Body() dto: PlaceOrderDto) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    // Implementação similar, mas sem persistir
    return this.tradeService.testOrder(userId, dto);
  }

  @ApiOperation({ summary: 'Cancel an open order' })
  @Delete('orders/:orderId')
  async cancelOrder(
    @Req() req,
    @Param('orderId') orderId: string,
    @Query('symbol') symbol: string,
  ) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    return this.tradeService.cancelOrder(userId, BigInt(orderId), symbol);
  }

  @ApiOperation({ summary: 'Get order status' })
  @Get('orders/:orderId')
  async getOrderStatus(
    @Req() req,
    @Param('orderId') orderId: string,
    @Query('symbol') symbol: string,
  ) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    return this.tradeService.getOrderStatus(userId, BigInt(orderId), symbol);
  }

  @ApiOperation({ summary: 'List open orders' })
  @Get('orders/open')
  async getOpenOrders(@Req() req, @Query('symbol') symbol?: string) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    return this.tradeService.getOpenOrders(userId, symbol);
  }

  @ApiOperation({ summary: 'Get trade history for a symbol' })
  @Get('history')
  async getHistory(
    @Req() req,
    @Query('symbol') symbol: string,
    @Query('limit') limit: number = 100,
    @Query('page') page: number = 1,
  ) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    return this.tradeService.getTradeHistory(userId, symbol, limit, page);
  }

  @ApiOperation({ summary: 'Get trade statistics for a symbol' })
  @Get('stats')
  async getStats(@Req() req, @Query('symbol') symbol: string) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    return this.tradeService.getTradeStats(userId, symbol);
  }

  @ApiOperation({ summary: 'Sync complete trade history' })
  @Post('sync/history')
  async syncHistory(@Req() req, @Query('symbol') symbol: string) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    return this.tradeService.syncTradeHistory(userId, symbol);
  }
}
```

---

## 4️⃣ TradeModule

### `src/trade/trade.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TradeService } from './trade.service';
import { TradeController } from './trade.controller';
import { PrismaService } from '@/prisma/prisma.service';
import { BinanceModule } from '@/binance/binance.module';

@Module({
  imports: [BinanceModule],
  providers: [TradeService, PrismaService],
  controllers: [TradeController],
  exports: [TradeService],
})
export class TradeModule {}
```

---

## 5️⃣ Atualização: AppModule

### `src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuthModule } from './auth/auth.module';
import { BinanceStreamClientModule } from './binance-stream-client/binance-stream-client.module';
import { EmailModule } from './email/email.module';
import { KlineAdminModule } from './kline-admin/kline-admin.module';
import { KlineServerModule } from './kline-server/kline-server.module';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';
import { WalletModule } from './wallet/wallet.module';
import { TradeModule } from './trade/trade.module'; // 👈 NOVO

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    EventEmitterModule.forRoot({
      wildcard: true,
    }),
    PrismaModule,
    UserModule,
    AuthModule,
    EmailModule,
    KlineServerModule,
    KlineAdminModule,
    BinanceStreamClientModule,
    WalletModule,
    TradeModule, // 👈 ADICIONAR AQUI
  ],
})
export class AppModule {}
```

---

## 6️⃣ Teste E2E: Exemplo

### `test/trade.e2e-spec.ts` (Trecho)

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';

describe('Trade (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtToken: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await app.init();

    // Setup: Criar usuário e fazer login
    const signupRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'test@trade.com',
        password: 'Test@1234',
        name: 'Trade Test',
      });

    userId = signupRes.body.userId;

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'test@trade.com',
        password: 'Test@1234',
      });

    jwtToken = loginRes.body.access_token;

    // Setup: Salvar credenciais Binance testnet
    await request(app.getHttpServer())
      .post('/wallet/credentials')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        apiKey: process.env.BINANCE_TESTNET_API_KEY,
        apiSecret: process.env.BINANCE_TESTNET_API_SECRET,
      });
  });

  it('POST /trade/orders - Place a BUY LIMIT order', async () => {
    const response = await request(app.getHttpServer())
      .post('/trade/orders')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'LIMIT',
        quantity: '0.001',
        price: '30000.00',
        timeInForce: 'GTC',
      })
      .expect(201);

    expect(response.body).toHaveProperty('orderId');
    expect(response.body.symbol).toBe('BTCUSDT');
    expect(response.body.status).toBe('NEW');
    expect(response.body.side).toBe('BUY');
  });

  it('GET /trade/orders/:orderId - Get order status', async () => {
    // Primeiro coloca uma ordem
    const placeRes = await request(app.getHttpServer())
      .post('/trade/orders')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        symbol: 'BTCUSDT',
        side: 'SELL',
        type: 'LIMIT',
        quantity: '0.001',
        price: '50000.00',
      });

    const orderId = placeRes.body.orderId;

    // Depois consulta o status
    const getRes = await request(app.getHttpServer())
      .get(`/trade/orders/${orderId}`)
      .query({ symbol: 'BTCUSDT' })
      .set('Authorization', `Bearer ${jwtToken}`)
      .expect(200);

    expect(getRes.body.orderId).toBe(orderId);
    expect(getRes.body.status).toBe('NEW');
  });

  it('DELETE /trade/orders/:orderId - Cancel order', async () => {
    // Coloca
    const placeRes = await request(app.getHttpServer())
      .post('/trade/orders')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'LIMIT',
        quantity: '0.001',
        price: '25000.00',
      });

    const orderId = placeRes.body.orderId;

    // Cancela
    const cancelRes = await request(app.getHttpServer())
      .delete(`/trade/orders/${orderId}`)
      .query({ symbol: 'BTCUSDT' })
      .set('Authorization', `Bearer ${jwtToken}`)
      .expect(200);

    expect(cancelRes.body.status).toBe('CANCELED');
  });

  it('GET /trade/orders/open - List open orders', async () => {
    const response = await request(app.getHttpServer())
      .get('/trade/orders/open')
      .query({ symbol: 'BTCUSDT' })
      .set('Authorization', `Bearer ${jwtToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('total');
    expect(Array.isArray(response.body.orders)).toBe(true);
  });

  it('GET /trade/history - Get trade history', async () => {
    const response = await request(app.getHttpServer())
      .get('/trade/history')
      .query({ symbol: 'BTCUSDT', limit: 50 })
      .set('Authorization', `Bearer ${jwtToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('symbol');
    expect(response.body).toHaveProperty('total');
    expect(Array.isArray(response.body.trades)).toBe(true);
  });

  afterAll(async () => {
    // Cleanup
    await prisma.order.deleteMany({ where: { userId } });
    await prisma.orderLog.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await app.close();
  });
});
```

---

## 🎯 Checklist de Implementação

### Fase 1: Setup
- [ ] Criar enums em `src/trade/enums/`
- [ ] Criar DTOs em `src/trade/dto/`
- [ ] Criar `trade.service.ts`
- [ ] Criar `trade.controller.ts`
- [ ] Criar `trade.module.ts`
- [ ] Atualizar `app.module.ts`

### Fase 2: Database
- [ ] Criar migration para `Order` model
- [ ] Criar migration para `OrderLog` model
- [ ] Executar `npx prisma migrate dev --name add_trade_models`
- [ ] Gerar tipos: `npx prisma generate`

### Fase 3: Testes
- [ ] Escrever testes unitários
- [ ] Escrever testes E2E
- [ ] Testar em Binance Testnet
- [ ] Validar com credenciais reais

---

**Exemplos Completos**: 1 de dezembro de 2025
