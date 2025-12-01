# 🏗️ DIAGRAMA DE ARQUITETURA - MÓDULO TRADE

## 📊 Fluxo Geral de Compra/Venda

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENTE (Web/Mobile)                         │
│  POST /trade/orders?symbol=BTCUSDT&side=BUY&price=45000&qty=0.001  │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    TRADE CONTROLLER                                  │
│  • Validação JWT (JwtAuthGuard)                                     │
│  • Extrair userId do token                                          │
│  • Validação de DTO com class-validator                             │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    TRADE SERVICE                                     │
│  1. Extrair credenciais do usuário (criptografadas)                │
│  2. Descriptografar com CryptoUtil                                  │
│  3. Validar que credenciais existem (status=ACTIVE)                │
│  4. Chamar BinanceRestClientService.signedPost()                   │
│  5. Tratar erros (-1021 timestamp, -1003 rate limit, etc)          │
│  6. Persistir Order e OrderLog (via Prisma $transaction)           │
│  7. Retornar ordem criada                                           │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│            BINANCE REST CLIENT SERVICE                               │
│  • buildSignedQuery(params, apiSecret)                              │
│  • nowWithOffset() - timestamp com sincronização                    │
│  • POST https://api.binance.com/api/v3/order                        │
│  • Retry automático se erro -1021                                   │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│            BINANCE API (Testnet/Production)                         │
│  ✓ Validações do servidor (LOT_SIZE, PRICE_FILTER, MAX_NUM_ORDERS) │
│  ✓ Matching engine processa ordem                                   │
│  ✓ Retorna Order response (ACK, RESULT, ou FULL)                   │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│            DATABASE (PostgreSQL via Prisma)                         │
│  ├─ users                                                            │
│  │  └─ email, senha, status, ...                                    │
│  ├─ exchangeCredentials                                             │
│  │  └─ userId, apiKey (criptografado), apiSecret (criptografado)   │
│  ├─ orders [NOVO]                                                   │
│  │  └─ userId, orderId, symbol, side, status, quantity, price, ... │
│  ├─ orderLogs [NOVO]                                                │
│  │  └─ userId, orderId, action, status, requestData, responseData  │
│  ├─ trades                                                           │
│  │  └─ userId, orderId, symbol, tradeId, price, quantity, ...      │
│  └─ walletBalances                                                  │
│     └─ userId, asset, free, locked, total, lastSyncAt             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔐 Fluxo de Segurança

```
┌──────────────────────────────────────────────────────────┐
│  Usuário faz login com email/senha                       │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│  AuthService gera JWT Token                              │
│  • sub: userId                                           │
│  • iat: data emissão                                     │
│  • exp: data expiração (60 minutos)                      │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│  Usuário salva credenciais Binance via POST /wallet/...  │
│  • apiKey: "bnbX1234567890" (PLAIN)                     │
│  • apiSecret: "nH123456789" (PLAIN)                     │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│  WalletService criptografa com CryptoUtil.encrypt()      │
│  • Salt: processo.env.CRYPTO_SALT                        │
│  • Algoritmo: AES-256-CBC                                │
│  • Salva no DB: apiKey criptografada                     │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│  Quando usuário faz uma ordem:                           │
│  1. Envia JWT no header: Authorization: Bearer <token>   │
│  2. JwtAuthGuard valida token                            │
│  3. Extrai userId do payload                             │
│  4. TradeService busca credenciais                       │
│  5. Descriptografa com CryptoUtil.decrypt()              │
│  6. Usa credenciais para assinar request Binance         │
│  7. Credenciais NUNCA expostas em logs/response          │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│  Tudo registrado em OrderLog (auditoria)                 │
│  • action: "PLACE"                                       │
│  • status: "SUCCESS"                                     │
│  • responseData: resposta Binance (SEM credenciais)      │
└──────────────────────────────────────────────────────────┘
```

---

## 🔄 Fluxo de Erro: -1021 (Timestamp)

```
┌──────────────────────────────────────────────────┐
│  Requisição #1 a Binance                         │
│  timestamp: Date.now() + timeOffsetMs             │
│  (Se timeOffsetMs = NaN, usa Date.now())          │
└────────────────┬─────────────────────────────────┘
                 │
                 ▼
         ┌───────────────┐
         │ Sucesso?      │
         └───┬───────┬───┘
             │       │
            SIM      NÃO
             │       │
             │       ▼
             │    ┌─────────────────────────┐
             │    │ Erro -1021?             │
             │    └────┬──────────────┬──────┘
             │         │              │
             │        SIM             NÃO
             │         │              │
             │         ▼              ▼
             │    ┌──────────────┐  ┌──────────┐
             │    │Resincronizar │  │Lançar    │
             │    │tempo         │  │erro      │
             │    │syncServerTime│  └──────────┘
             │    └────┬─────────┘
             │         │
             │         ▼
             │    ┌──────────────┐
             │    │timeOffsetMs  │
             │    │= server-local │
             │    └────┬─────────┘
             │         │
             │         ▼
             │    Requisição #2 a Binance
             │    (COM timestamp sincronizado)
             │         │
             └─────────┬─────────────────────┐
                       ▼                     ▼
                    Sucesso              Erro (outro)
```

---

## 🗄️ Modelo de Dados (Diagrama ER)

```
┌─────────────────┐
│     User        │
├─────────────────┤
│ id (PK)         │◄────────────────┐
│ email           │                 │
│ password        │                 │
│ status          │                 │
└─────────────────┘                 │
      ▲                             │
      │                             │
      │ 1:N                         │
      │                       ┌──────────────────────┐
      ├───────────────────────│ ExchangeCredential  │
      │                       ├──────────────────────┤
      │                       │ id (PK)              │
      │                       │ userId (FK)          │
      │                       │ apiKey (encrypted)   │
      │                       │ apiSecret (encrypted)│
      │                       │ exchange             │
      │                       │ status               │
      │                       └──────────────────────┘
      │
      │ 1:N
      ├───────────────────────────────┐
      │                               │
      ▼                               ▼
┌──────────────────┐          ┌─────────────────────┐
│  Order [NOVO]    │          │ WalletBalance       │
├──────────────────┤          ├─────────────────────┤
│ id (PK)          │          │ id (PK)             │
│ userId (FK)      │          │ userId (FK)         │
│ orderId          │          │ asset               │
│ clientOrderId    │          │ free                │
│ symbol           │          │ locked              │
│ side (BUY/SELL)  │          │ total               │
│ type             │          │ lastSyncAt          │
│ status           │          └─────────────────────┘
│ quantity         │
│ executedQty      │
│ price            │
│ createdAt        │          ┌─────────────────────┐
│ updatedAt        │◄─────────┤ Trade               │
└──────────────────┘   1:N    ├─────────────────────┤
                               │ id (PK)             │
                               │ userId (FK)         │
                               │ orderId (FK)        │
                               │ symbol              │
                               │ tradeId             │
                               │ price               │
                               │ quantity            │
                               │ commission          │
                               │ isBuyer             │
                               │ executedTime        │
                               └─────────────────────┘

      1:N
      │
      ▼
┌──────────────────────┐
│  OrderLog [NOVO]     │
├──────────────────────┤
│ id (PK)              │
│ userId (FK)          │
│ orderId              │
│ action (PLACE/etc)   │
│ status (SUCCESS/FAIL)│
│ message              │
│ requestData (JSON)   │
│ responseData (JSON)  │
│ createdAt            │
└──────────────────────┘
```

---

## 📡 API Endpoints Estrutura

```
/trade                                 # Base path (autenticado)
│
├─ POST   /orders                      # Colocar nova ordem
│         Body: { symbol, side, type, quantity, price, ... }
│         Response: { orderId, status, ... }
│
├─ POST   /orders/test                 # Testar ordem (sem executar)
│         Body: (mesmo de POST /orders)
│         Response: { valid: true/false, message }
│
├─ DELETE /orders/:orderId             # Cancelar ordem
│         Params: symbol (query)
│         Response: { orderId, status: CANCELED }
│
├─ DELETE /orders                      # Cancelar TODAS de um símbolo
│         Params: symbol (query)
│         Response: { canceled: N, orders: [...] }
│
├─ GET    /orders/:orderId             # Status de uma ordem
│         Params: symbol (query)
│         Response: { orderId, status, quantity, executedQty, ... }
│
├─ GET    /orders/open                 # Listar abertas
│         Params: symbol (query, opcional)
│         Response: { total, orders: [...] }
│
├─ GET    /history                     # Histórico de trades
│         Params: symbol (req), startTime, endTime, limit, page
│         Response: { symbol, total, trades: [...] }
│
├─ GET    /stats                       # Estatísticas
│         Params: symbol (required)
│         Response: { totalTrades, totalBuys, totalSells, ... }
│
└─ POST   /sync/history                # Sincronizar histórico
          Params: symbol (required)
          Response: { synced, totalInDatabase, hasMore }
```

---

## ⚙️ Dependências Internas

```
TradeModule
├─ TradeController
│  └─ TradeService
│
└─ TradeService
   ├─ PrismaService              (database)
   ├─ BinanceRestClientService   (API calls)
   ├─ CryptoUtil                 (decrypt credentials)
   └─ Logger (NestJS)
```

---

## 🔗 Integração com Módulos Existentes

```
┌─────────────────────────────────────────────────────────┐
│                    AppModule                             │
├─────────────────────────────────────────────────────────┤
│ imports: [                                              │
│   ConfigModule.forRoot(),                              │
│   PrismaModule,                                         │
│   UserModule,                                           │
│   AuthModule,                                           │
│   EmailModule,                                          │
│   WalletModule,                ← Módulo relacionado    │
│   KlineServerModule,                                    │
│   KlineAdminModule,                                     │
│   BinanceStreamClientModule,                            │
│   TradeModule,                 ← NOVO MÓDULO           │
│ ]                                                       │
└─────────────────────────────────────────────────────────┘
         ▲                                   ▲
         │                                   │
         │                             ┌─────┴──────────┐
         │                             │                │
         └─ Reutiliza               Usa            Usa
           PrismaService        BinanceRestClientService
           AuthModule           (já existente)
           CryptoUtil
           (já existentes)
```

---

## 🧪 Fluxo de Teste E2E

```
┌─────────────────────────────────────────────────────┐
│  test/trade.e2e-spec.ts                             │
├─────────────────────────────────────────────────────┤
│ describe('Trade Module', () => {                    │
│                                                     │
│   1. Setup                                          │
│      - Criar usuário teste                         │
│      - Login e obter JWT                           │
│      - Salvar credenciais Binance testnet          │
│                                                     │
│   2. Test: Colocar Ordem LIMIT BUY                 │
│      POST /trade/orders                            │
│      ✓ Status 201                                  │
│      ✓ orderId definido                            │
│      ✓ status = "NEW"                              │
│                                                     │
│   3. Test: Testar Ordem (sem executar)             │
│      POST /trade/orders/test                       │
│      ✓ Status 200                                  │
│      ✓ valid = true                                │
│                                                     │
│   4. Test: Consultar Ordem                         │
│      GET /trade/orders/:orderId                    │
│      ✓ Status 200                                  │
│      ✓ Status ainda = "NEW"                        │
│                                                     │
│   5. Test: Cancelar Ordem                          │
│      DELETE /trade/orders/:orderId                 │
│      ✓ Status 200                                  │
│      ✓ Status agora = "CANCELED"                   │
│                                                     │
│   6. Test: Ordens Abertas                          │
│      GET /trade/orders/open                        │
│      ✓ Status 200                                  │
│      ✓ Retorna array de ordens                     │
│                                                     │
│   7. Test: Histórico de Trades                     │
│      GET /trade/history?symbol=BTCUSDT             │
│      ✓ Status 200                                  │
│      ✓ Retorna array de trades                     │
│                                                     │
│   8. Teardown                                       │
│      - Limpar dados teste do DB                    │
│                                                     │
│ })                                                  │
└─────────────────────────────────────────────────────┘
```

---

## 📊 Rate Limiting (Conceitual)

```
┌──────────────────────────────────────────────────────┐
│  Binance Rate Limits (REQUEST_WEIGHT)                │
│  └─ 6000 weight por 1 minuto                         │
│                                                      │
│  Operações:                                          │
│  • POST /api/v3/order          = 1 weight           │
│  • GET /api/v3/openOrders      = 3 weight (com sym) │
│  • GET /api/v3/myTrades        = 10 weight          │
│  • GET /api/v3/account         = 10 weight          │
│                                                      │
│  Implementação:                                      │
│  • Circuit breaker no TradeService                   │
│  • Respeitar header X-MBX-USED-WEIGHT-1M           │
│  • Backoff exponencial se 429                        │
└──────────────────────────────────────────────────────┘
```

---

**Diagrama Criado**: 1 de dezembro de 2025  
**Compatível com**: NestJS 11, Prisma 6, PostgreSQL 14+
