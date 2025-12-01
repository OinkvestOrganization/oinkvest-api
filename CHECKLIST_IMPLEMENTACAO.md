# ✅ CHECKLIST DE IMPLEMENTAÇÃO - OIN-94 (MARKET ORDERS)

## 📅 Fase 1: Setup do Módulo (1 dia)

### Database & Prisma
- [ ] Criar migration para `Order` model
  - [ ] Fields: orderId (BigInt unique), clientOrderId, symbol, side, type, status, quantity, executedQty, price, transactTime, userId FK
  - [ ] Indexes: `@@unique([userId, orderId])`, `@@index([userId, symbol])`, `@@index([status])`
  
- [ ] Criar migration para `OrderLog` model
  - [ ] Fields: orderId, action (PLACE, QUERY), status (SUCCESS, FAILURE), message, requestData (Json), responseData (Json)
  - [ ] Indexes: `@@index([userId])`, `@@index([orderId])`

- [ ] Executar: `npx prisma migrate dev --name add_trade_models`
- [ ] Gerar types: `npx prisma generate`

### Arquivo de Estrutura
```
src/trade/
├── trade.module.ts                 # Módulo DI
├── trade.controller.ts             # 3 endpoints REST
├── trade.service.ts                # Lógica principal
├── trade.service.spec.ts           # Testes unitários
├── dto/
│   ├── place-order.dto.ts          # Input validation
│   └── place-order-response.dto.ts # Response type
└── enums/
    ├── order-side.enum.ts          # BUY | SELL
    └── order-status.enum.ts        # FILLED, PARTIALLY_FILLED, CANCELED
```

### Criar DTOs
- [ ] `PlaceOrderDto`: symbol, side (BUY/SELL), type (MARKET), quantity OR quoteOrderQty, validações
- [ ] `PlaceOrderResponseDto`: orderId, symbol, side, status, quantity, executedQty, fills, transactTime
- [ ] `OrderHistoryItemDto`: orderId, symbol, side, status, quantity, executedQty, cumulativeQuoteQty, createdAt

### Criar Enums
- [ ] `OrderSide`: BUY, SELL
- [ ] `OrderStatus`: FILLED, PARTIALLY_FILLED, CANCELED, EXPIRED, REJECTED
- [ ] `OrderType`: MARKET (única opção por enquanto)

### Atualizar AppModule
- [ ] Importar `TradeModule` em `app.module.ts`
- [ ] Adicionar a lista `imports: [ ..., TradeModule ]`

---

## 🔧 Fase 2: Core Service (1-2 dias)

### TradeService::placeMarketOrder()
- [ ] Extrair userId do request
- [ ] Validar credenciais Binance existem
- [ ] Validar DTO (quantidade OU quoteOrderQty, não ambos)
- [ ] Descriptografar apiKey/apiSecret via `CryptoUtil.decrypt()`
- [ ] Montar parâmetros Binance:
  ```typescript
  {
    symbol, side, type: 'MARKET',
    quantity || quoteOrderQty,
    newOrderRespType: 'FULL'
  }
  ```
- [ ] Chamar `BinanceRestClientService.signedPost('/api/v3/order', ...)`
- [ ] Tratar erro -1021 (já feito automaticamente)
- [ ] Em transação Prisma:
  - [ ] Criar `Order` record (persistence)
  - [ ] Criar `OrderLog` record (auditoria)
  - [ ] Se há fills: sincronizar em `Trade` via `syncTradesFromFills()`
- [ ] Retornar response formatado

### TradeService::getOrder()
- [ ] Validar ordem pertence ao usuário
- [ ] Buscar em `Order` model
- [ ] Retornar dados básicos

### TradeService::listOrders()
- [ ] Query `Order` com filtros (symbol, limit, page)
- [ ] Ordenar por `createdAt DESC`
- [ ] Retornar com paginação

### Integração com BinanceRestClientService
- [ ] ✅ Já está pronto (método `signedPost()`)
- [ ] ✅ Já sincroniza timestamp automaticamente
- [ ] ✅ Já trata -1021 com retry

### Error Handling
- [ ] -1000: Invalid request → 400 Bad Request
- [ ] -1003: Weight exceeded → 429 Too Many Requests
- [ ] -1013: Invalid quantity → 400 Bad Request
- [ ] -1021: Timestamp → Retry automático (já implementado)
- [ ] -2010: Insufficient balance → 400 Bad Request
- [ ] Qualquer outro: 400 com mensagem Binance

---

## 🌐 Fase 3: Endpoints REST (1-2 dias)

### POST /trade/orders
```typescript
@Post('orders')
@HttpCode(HttpStatus.CREATED)
async placeOrder(@Req() req, @Body() dto: PlaceOrderDto) {
  const userId = req.user.userId || req.user.id || req.user.sub;
  return this.tradeService.placeMarketOrder(userId, dto);
}
```

- [ ] Validar DTO automaticamente (class-validator)
- [ ] Extrair userId corretamente
- [ ] Retornar 201 Created com Order data
- [ ] Documentar com `@ApiOperation()`, `@ApiBody()`, `@ApiCreatedResponse()`

### GET /trade/orders/:orderId
```typescript
@Get('orders/:orderId')
async getOrder(@Req() req, @Param('orderId') orderId: string, @Query('symbol') symbol: string) {
  const userId = req.user.userId || req.user.id || req.user.sub;
  return this.tradeService.getOrder(userId, BigInt(orderId), symbol);
}
```

- [ ] Query param `symbol` obrigatório
- [ ] Converter `orderId` para BigInt
- [ ] Retornar 200 com dados
- [ ] Documentação Swagger

### GET /trade/orders
```typescript
@Get('orders')
async listOrders(@Req() req, @Query() query: ListOrdersQueryDto) {
  const userId = req.user.userId || req.user.id || req.user.sub;
  return this.tradeService.listOrders(userId, query);
}
```

- [ ] Query params: symbol (obrigatório), limit, page
- [ ] Retornar { total, orders: [...] }
- [ ] Paginação funcionando
- [ ] Documentação Swagger

### Validação Global
- [ ] Todos endpoints com `@UseGuards(JwtAuthGuard)`
- [ ] Todos com `ValidationPipe` (whitelist, transform)
- [ ] Todos com `@ApiBearerAuth()` no controller
- [ ] Todos com documentação `@ApiOperation()`

---

## 🧪 Fase 4: Testes (1-2 dias)

### Arquivo: test/trade.e2e-spec.ts

#### Setup
- [ ] Criar usuário de teste
- [ ] Login e obter JWT token
- [ ] Salvar credenciais Binance testnet via `POST /wallet/credentials`

#### Testes
- [ ] ✅ test: 'should place a BUY MARKET order'
  - Enviar: { symbol: 'BTCUSDT', side: 'BUY', type: 'MARKET', quantity: '0.001' }
  - Validar: orderId existe, status = 'FILLED', executedQty > 0

- [ ] ✅ test: 'should place a SELL MARKET order'
  - Enviar: { symbol: 'BTCUSDT', side: 'SELL', type: 'MARKET', quantity: '0.001' }
  - Validar: status = 'FILLED'

- [ ] ✅ test: 'should place order with quoteOrderQty'
  - Enviar: { symbol: 'BTCUSDT', side: 'BUY', type: 'MARKET', quoteOrderQty: '50' }
  - Validar: cumulativeQuoteQty aproximado de 50

- [ ] ✅ test: 'should get order details'
  - POST /trade/orders (criar)
  - GET /trade/orders/:orderId (consultar)
  - Validar: mesmo orderId retornado

- [ ] ✅ test: 'should list order history'
  - Criar ordem
  - GET /trade/orders?symbol=BTCUSDT
  - Validar: ordem aparece na lista

- [ ] ✅ test: 'should reject insufficient balance'
  - Enviar quantidade absurda
  - Validar: 400 com erro -2010

- [ ] ✅ test: 'should reject missing credentials'
  - User sem credenciais salvos
  - POST /trade/orders
  - Validar: 404 Not Found

#### Testes Unitários (TradeService)
- [ ] test: 'should validate quantity vs quoteOrderQty'
- [ ] test: 'should encrypt/decrypt credentials correctly'
- [ ] test: 'should create Order and OrderLog in transaction'
- [ ] test: 'should sync fills from MARKET order response'

#### Integração com Testnet
- [ ] Usar credenciais de testnet
- [ ] Validar reponse real da Binance
- [ ] Validar dados persistem no banco

---

## 🔐 Fase 5: Validações & Segurança (1 dia)

### Validação de Negócio
- [ ] Validar `symbol` (matches `/^[A-Z]{6,10}$/`)
- [ ] Validar `side` (BUY ou SELL)
- [ ] Validar quantidade (positiva, decimal válido)
- [ ] Validar quoteOrderQty (positiva ou undefined)
- [ ] Não permitir quantidade AND quoteOrderQty simultaneamente

### Validação de Saldo (Pré-ordem)
- [ ] Para BUY: Verificar saldo USDT ≥ quantidade
- [ ] Para SELL: Verificar saldo do ativo ≥ quantidade
- [ ] Usar saldos sincronizados de `WalletBalance`

### Validação contra Binance Filters
- [ ] Chamar `GET /api/v3/exchangeInfo` (cachear por 1h)
- [ ] Validar `LOT_SIZE`: minQty ≤ qty ≤ maxQty
- [ ] Validar `NOTIONAL`: (preço aproximado × qty) ≥ minNotional
- [ ] Retornar erro descriptivo se falhar

### Segurança
- [ ] Nunca logar apiKey/apiSecret
- [ ] Sempre descriptografar na memória (nunca persistir em texto)
- [ ] Verificar `@UseGuards(JwtAuthGuard)` em todos endpoints
- [ ] Rate limit: respeitarheader `X-MBX-USED-WEIGHT-1M` da Binance

### Tratamento de Erros
- [ ] Criar erro handler customizado para Binance errors
- [ ] Mapear cada código para HTTP status apropriado
- [ ] Retornar mensagem amigável (não expor detalhes técnicos)

---

## 📚 Fase 6: Documentação (0.5 dias)

### Swagger/OpenAPI
- [ ] `@ApiTags('Trade')`
- [ ] `@ApiBearerAuth()` em controller
- [ ] `@ApiOperation()` em cada endpoint
- [ ] `@ApiBody()` com examples
- [ ] `@ApiCreatedResponse()` / `@ApiOkResponse()`
- [ ] `@ApiNotFoundResponse()`, `@ApiBadRequestResponse()`

### README do Módulo
```
docs/trade.md
├── Visão Geral
├── Como Usar (curl examples)
├── DTOs & Response Formats
├── Tratamento de Erros
├── Integração com /wallet/trades
└── Limitações & Futuro (LIMIT orders)
```

### Exemplos em cURL
```bash
# BUY MARKET
curl -X POST http://localhost:3000/trade/orders \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTCUSDT",
    "side": "BUY",
    "type": "MARKET",
    "quantity": "0.001"
  }'

# SELL com USDT value
curl -X POST http://localhost:3000/trade/orders \
  -H "Authorization: Bearer $JWT" \
  -d '{
    "symbol": "ETHUSDT",
    "side": "SELL",
    "type": "MARKET",
    "quoteOrderQty": "100"
  }'

# Ver ordem
curl http://localhost:3000/trade/orders/12345?symbol=BTCUSDT \
  -H "Authorization: Bearer $JWT"

# Listar ordens
curl http://localhost:3000/trade/orders?symbol=BTCUSDT&limit=50 \
  -H "Authorization: Bearer $JWT"
```

### Notas no Código
- [ ] Comentar decisões de design
- [ ] Explicar por que apenas MARKET
- [ ] Referenciar wallet.sync para histórico

---

## 🎯 Checklist Final

- [ ] **Fase 1**: Banco, DTOs, Enums, Module, AppModule
- [ ] **Fase 2**: TradeService completo (3 métodos)
- [ ] **Fase 3**: 3 endpoints REST + Swagger
- [ ] **Fase 4**: Testes E2E + Unitários (testnet passando)
- [ ] **Fase 5**: Validações + Segurança
- [ ] **Fase 6**: Documentação completa

### Antes de fazer commit:
- [ ] Rodar `npm run lint` (ESLint sem erros)
- [ ] Rodar `npm run build` (TypeScript compile)
- [ ] Rodar `npm run test:e2e` (testes passam no testnet)
- [ ] Revisar código (PR ready)
- [ ] Atualizar CHANGELOG.md
- [ ] Fazer commit com mensagem: `feat: [OIN-94] implementar módulo trade com MARKET orders`

---

**Timeline Realista**: 5-9 dias  
**Complexidade**: ⭐⭐⭐ (média)  
**Risco**: 🟢 Baixo (Binance API estável, reutiliza code existente)
