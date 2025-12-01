# 📋 PLANO DE DESENVOLVIMENTO: Módulo de Compra e Venda de Ativos (OIN-94)

**Data**: 1 de dezembro de 2025  
**Branch**: OIN-94  
**Status**: ✅ Iniciado com commit de marcação

---

## 📊 1. RESUMO EXECUTIVO

Este documento apresenta o **plano estratégico completo** para implementar funcionalidades de **compra e venda de ativos (trading)** na plataforma Oinkvest, integrando com a API Spot Trading da Binance.

### Objetivo Principal
Permitir que usuários da Oinkvest comprem e vendam criptomoedas diretamente através da API, com sincronização de histórico de trades e rastreamento de ordens.

---

## 🎯 2. VISÃO GERAL DA ARQUITETURA

### 2.1 Estrutura Atual do Projeto
```
oinkvest-api/
├── src/
│   ├── auth/                    # Autenticação JWT
│   ├── wallet/                  # Saldos e sincronização
│   │   ├── wallet.service.ts    # Sincronização de saldos
│   │   └── trade.service.ts     # Histórico de trades
│   ├── binance/                 # Cliente REST Binance
│   │   └── binance-rest-client.service.ts  # Requisições assinadas
│   └── app.module.ts
├── prisma/
│   └── schema.prisma            # Modelos de dados
└── test/                        # Testes E2E
```

### 2.2 Stack Tecnológico
- **Framework**: NestJS 11
- **Banco de Dados**: PostgreSQL com Prisma ORM
- **Autenticação**: JWT com Guards
- **API Binance**: REST API v3
- **Criptografia**: Armazenamento cifrado de chaves API

### 2.3 Padrões Estabelecidos no Projeto
1. ✅ **Modularidade**: Cada feature em um módulo separado
2. ✅ **Serviços Reusáveis**: `BinanceRestClientService` para requisições assinadas
3. ✅ **Tratamento de Tempo**: Sincronização de offset temporal com Binance
4. ✅ **Transações**: Uso de `$transaction()` do Prisma para atomicidade
5. ✅ **Logging**: Logger nativo do NestJS
6. ✅ **Segurança**: Criptografia de credenciais com `CryptoUtil`
7. ✅ **Validação**: Pipes e DTOs com class-validator

---

## 🔌 3. ENDPOINTS DA API BINANCE PARA TRADING

### 3.1 Endpoints Essenciais (Implementaremos)

#### **1. Colocar Ordem de Compra/Venda (MARKET)**
```
POST /api/v3/order
Weight: 1
Required: symbol, side (BUY/SELL), type (MARKET), quantity (ou quoteOrderQty)
```

**Tipos de Ordem Implementados:**
- ✅ `MARKET`: Executa ao melhor preço disponível (ÚNICO TIPO)

**Tipos NÃO Implementados (Fase Futura):**
- ❌ `LIMIT`: Preço e quantidade fixos
- ❌ `STOP_LOSS / STOP_LOSS_LIMIT`: Venda automática se preço cair
- ❌ `TAKE_PROFIT / TAKE_PROFIT_LIMIT`: Venda automática se preço subir
- ❌ `LIMIT_MAKER`: Apenas maker, rejeita se for taker

**Parâmetros Críticos:**
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| symbol | STRING | Ex: BTCUSDT, ETHUSDT |
| side | ENUM | BUY ou SELL |
| type | ENUM | LIMIT, MARKET, STOP_LOSS, etc |
| quantity | DECIMAL | Quantidade do ativo base |
| quoteOrderQty | DECIMAL | Valor em USDT (alternativa a quantity) |
| price | DECIMAL | Preço (obrigatório para LIMIT) |
| timeInForce | ENUM | GTC (Good-Till-Cancel), IOC, FOK |
| newOrderRespType | ENUM | FULL (resposta detalhada obrigatória para MARKET) |

---

#### **2. Sincronização de Histórico** (✅ JÁ IMPLEMENTADO NA WALLET)

**IMPORTANTE**: A sincronização de histórico de trades **JÁ EXISTE** no módulo `wallet` e NÃO será duplicada:

- ✅ `POST /wallet/sync/trades?symbol=BTCUSDT` - Sincronizar um símbolo
- ✅ `POST /wallet/sync/trades/batch` - Sincronizar múltiplos símbolos
- ✅ `POST /wallet/sync/trades/all` - Sincronizar toda a carteira
- ✅ `GET /wallet/trades` - Listar com filtros
- ✅ `GET /wallet/trades/stats` - Estatísticas
- ✅ `GET /wallet/trades/summary` - Resumo completo

**Não será replicado no módulo `trade`.**

---

### 3.2 Tratamentos de Erro Críticos (MARKET Orders)

| Código | Mensagem | Solução |
|--------|----------|--------|
| -1000 | Invalid request | Validar parâmetros |
| -1001 | Disconnected | Retry com backoff |
| -1003 | Weight exceeded | Aguardar rate limit (6000/min) |
| -1013 | Invalid quantity | Validar contra LOT_SIZE filter |
| -1015 | Muitas novas ordens | Rate limit de ordens |
| -1021 | Timestamp fora da janela | **RESINCRONIZAR TEMPO** (já feito automaticamente) |
| -2010 | Saldo insuficiente | Verificar saldo USDT/ativo disponível |
| -2011 | Ordem não encontrada | (Raro em MARKET, ordem foi executada) |

---

## 📦 4. MODELO DE DADOS (Prisma Schema)

### 4.1 Estrutura Existente no `schema.prisma`

Já temos:
```prisma
model Trade {
  id                  String   @id @default(cuid())
  user                User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId              String
  symbol              String   // ex: BTCUSDT
  tradeId             BigInt   // ID da trade da Binance
  orderId             BigInt   // ID da ordem
  orderListId         BigInt   @default(-1)
  price               Decimal
  quantity            Decimal
  quoteQuantity       Decimal
  commission          Decimal
  commissionAsset     String   // ex: BNB, USDT
  isBuyer             Boolean  // true = compra
  isMaker             Boolean
  isBestMatch         Boolean  @default(true)
  executedTime        DateTime
  lastSyncAt          DateTime @default(now())
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}
```

### 4.2 Novos Modelos Necessários

#### **Order Model** (para rastrear ordens abertas/canceladas)
```prisma
model Order {
  id                      String      @id @default(cuid())
  user                    User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId                  String
  
  # Identifiers
  orderId                 BigInt      // ID da ordem na Binance
  clientOrderId           String      // ID customizado
  symbol                  String      // BTCUSDT
  
  # Order Details
  side                    String      // BUY ou SELL
  type                    String      // LIMIT, MARKET, STOP_LOSS, etc
  timeInForce             String      // GTC, IOC, FOK
  
  # Quantities & Prices
  quantity                Decimal     // Quantidade original
  executedQty             Decimal     // Executada
  price                   Decimal     // Preço (para LIMIT)
  stopPrice               Decimal?    // Para STOP_LOSS/TAKE_PROFIT
  
  # Status
  status                  String      // NEW, FILLED, CANCELED, EXPIRED, REJECTED
  
  # Timing
  transactTime            DateTime    // Quando foi criada na Binance
  createdAt               DateTime    @default(now())
  updatedAt               DateTime    @updatedAt
  
  # Relationships
  trades                  Trade[]     // Trades geradas por esta ordem
  
  @@unique([userId, orderId])
  @@index([userId, symbol])
  @@index([status])
}
```

#### **OrderLog Model** (para auditoria)
```prisma
model OrderLog {
  id          String   @id @default(cuid())
  user        User?    @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId      String?
  
  orderId     BigInt
  action      String   // PLACE, CANCEL, TEST, QUERY
  status      String   // SUCCESS, FAILURE, PENDING
  message     String?  // Erro ou resposta
  
  requestData Json?    // Dados enviados
  responseData Json?   // Resposta recebida
  
  createdAt   DateTime @default(now())
  
  @@index([userId])
  @@index([orderId])
}
```

---

## 🛠️ 5. ESTRUTURA DO NOVO MÓDULO: `trade`

### 5.1 Arquivos a Serem Criados

```
src/trade/
├── trade.module.ts                 # Módulo
├── trade.controller.ts             # Endpoints
├── trade.service.ts                # Lógica de negócio
├── trade.service.spec.ts           # Testes
├── dto/
│   ├── place-order.dto.ts          # Input para criar ordem
│   ├── place-order-response.dto.ts # Resposta da criação
│   ├── cancel-order.dto.ts         # Input para cancelar
│   ├── order-status.dto.ts         # Status de uma ordem
│   ├── open-orders.dto.ts          # Listar ordens abertas
│   └── order-history.dto.ts        # Histórico
└── enums/
    ├── order-side.enum.ts          # BUY, SELL
    ├── order-type.enum.ts          # LIMIT, MARKET, etc
    └── order-status.enum.ts        # NEW, FILLED, CANCELED, etc
```

### 5.2 Responsabilidades do Módulo `trade`

| Componente | Responsabilidade |
|-----------|-----------------|
| **TradeService** | Lógica de negócio, validações, chamadas Binance |
| **TradeController** | Endpoints REST, autenticação JWT |
| **DTOs** | Validação de entrada e tipagem |
| **Enums** | Tipos de ordem e status |

---

## 🔄 6. FLUXO DAS OPERAÇÕES

### 6.1 Fluxo: Comprar um Ativo (LIMIT)

```
1. Usuário → POST /trade/orders (body: symbol, side, quantity, price)
2. Controller valida DTO
3. Service extrai credenciais do usuário
4. Service chama Binance `POST /api/v3/order`
5. Binance retorna Order Response (ACK, RESULT ou FULL)
6. Service persiste Order no banco
7. Service loga ação em OrderLog
8. Controller retorna order details ao usuário
9. (Opcional) Webhook da Binance atualiza trades conforme executam
```

### 6.2 Fluxo: Cancelar Ordem

```
1. Usuário → DELETE /trade/orders/:orderId
2. Controller valida parâmetros
3. Service verifica se ordem pertence ao usuário
4. Service chama Binance `DELETE /api/v3/order`
5. Binance cancela e retorna status CANCELED
6. Service atualiza Order no banco (status = CANCELED)
7. Service loga cancelamento
8. Controller retorna status atualizado
```

### 6.3 Fluxo: Sincronizar Histórico de Trades (✅ JÁ EXISTE NA WALLET)

**Este fluxo JÁ ESTÁ IMPLEMENTADO no módulo `wallet`**. NÃO será duplicado no módulo `trade`.

**Endpoints existentes:**
1. **Sincronizar um símbolo**: `POST /wallet/sync/trades?symbol=BTCUSDT`
2. **Sincronizar múltiplos**: `POST /wallet/sync/trades/batch` (body: { symbols: [...] })
3. **Sincronizar tudo**: `POST /wallet/sync/trades/all`
4. **Listar histórico**: `GET /wallet/trades?symbol=BTCUSDT&limit=100&page=1`
5. **Estatísticas**: `GET /wallet/trades/stats?symbol=BTCUSDT`
6. **Resumo da carteira**: `GET /wallet/trades/summary`

**Fluxo (já implementado):**
```
1. Usuário → POST /wallet/sync/trades?symbol=BTCUSDT
2. Service extrai credenciais do usuário
3. Service chama Binance `GET /api/v3/myTrades` com paginação fromId
4. Itera sobre todas as páginas de trades
5. Para cada trade → upsert em Trade model (no banco Prisma)
6. Retorna resumo: { synced, totalInDatabase, hasMore, lastSyncedTradeTime }
```

---

## 🔐 7. VALIDAÇÕES E SEGURANÇA

### 7.1 Validações de Entrada (DTO)
```typescript
export class PlaceOrderDto {
  @IsString()
  @Matches(/^[A-Z]{6,10}$/)  // Ex: BTCUSDT
  symbol: string;

  @IsEnum(['BUY', 'SELL'])
  side: 'BUY' | 'SELL';

  @IsEnum(['LIMIT', 'MARKET', 'STOP_LOSS', ...])
  type: string;

  @IsDecimal({ decimal_digits: '1,8' })
  quantity: string;

  @IsDecimal({ decimal_digits: '1,8' })
  @IsOptional()
  price?: string;

  @IsEnum(['GTC', 'IOC', 'FOK'])
  @IsOptional()
  timeInForce?: string;
}
```

### 7.2 Validações de Negócio
- ✅ **Credenciais**: Usuário precisa ter credenciais Binance salvas
- ✅ **Saldo**: Verificar se tem saldo suficiente antes de BUY
- ✅ **Quantidade**: Validar contra LOT_SIZE filter da Binance
- ✅ **Preço**: Validar contra PRICE_FILTER da Binance
- ✅ **Timestamp**: Sincronizar offset antes de qualquer ordem

### 7.3 Tratamento de Offset Temporal
O `BinanceRestClientService` já tem:
```typescript
private timeOffsetMs = Number.NaN;  // Sincroniza no primeiro uso

private nowWithOffset(): number {
  return Number.isFinite(this.timeOffsetMs)
    ? Date.now() + this.timeOffsetMs
    : Date.now();
}
```

Se receber erro `-1021 (Timestamp)`, resincroniza automaticamente.

---

## 📈 8. ENDPOINTS A IMPLEMENTAR

### **Grupo 1: Colocar Ordens de Mercado**

#### `POST /trade/orders`
**Descrição**: Criar uma nova ordem de COMPRA ou VENDA com preço de mercado

**Request**:
```json
{
  "symbol": "BTCUSDT",
  "side": "BUY",
  "type": "MARKET",
  "quantity": "0.001"
}
```

**Ou alternativa (valor em USDT):**
```json
{
  "symbol": "BTCUSDT",
  "side": "BUY",
  "type": "MARKET",
  "quoteOrderQty": "50.00"
}
```

**Response (201)**:
```json
{
  "orderId": 12345,
  "clientOrderId": "myOrder1",
  "symbol": "BTCUSDT",
  "side": "BUY",
  "type": "MARKET",
  "status": "FILLED",
  "quantity": "0.001",
  "executedQty": "0.001",
  "cumulativeQuoteQty": "45123.50",
  "fills": [
    {
      "price": "45123.50",
      "qty": "0.001",
      "commission": "0.000001",
      "commissionAsset": "USDT"
    }
  ],
  "transactTime": "2025-12-01T10:30:45.123Z",
  "createdAt": "2025-12-01T10:30:45.123Z"
}
```

---

### **Grupo 2: Consultar Ordens Executadas**

#### `GET /trade/orders/:orderId`
**Descrição**: Obter detalhes de uma ordem já executada (MARKET)

**Query Params**:
- `symbol` (obrigatório)

**Response (200)**:
```json
{
  "orderId": 12345,
  "clientOrderId": "myOrder1",
  "symbol": "BTCUSDT",
  "side": "BUY",
  "type": "MARKET",
  "status": "FILLED",
  "quantity": "0.001",
  "executedQty": "0.001",
  "cumulativeQuoteQty": "45123.50",
  "createdAt": "2025-12-01T10:30:45.123Z"
}
```

---

#### `GET /trade/orders`
**Descrição**: Listar histórico de ordens executadas do usuário

**Query Params**:
- `symbol` (obrigatório)
- `limit` (default: 100, max: 500)
- `page` (default: 1)

**Response (200)**:
```json
{
  "total": 25,
  "orders": [
    {
      "orderId": 12345,
      "symbol": "BTCUSDT",
      "side": "BUY",
      "status": "FILLED",
      "quantity": "0.001",
      "executedQty": "0.001",
      "cumulativeQuoteQty": "45123.50",
      "createdAt": "2025-12-01T10:30:45.123Z"
    }
  ]
}
```

---

### **Grupo 3: Sincronização de Histórico** (✅ NA WALLET - NÃO DUPLICAR)

**Use os endpoints da wallet:**
- `POST /wallet/sync/trades?symbol=BTCUSDT` - Sincronizar histórico de trades
- `GET /wallet/trades?symbol=BTCUSDT` - Listar trades executadas
- `GET /wallet/trades/stats?symbol=BTCUSDT` - Estatísticas de trades

---

## 🧪 9. CASOS DE TESTE (E2E)

### 9.1 Teste: Criar Ordem MARKET BUY
```typescript
it('should place a BUY MARKET order', async () => {
  const response = await request(app.getHttpServer())
    .post('/trade/orders')
    .set('Authorization', `Bearer ${jwtToken}`)
    .send({
      symbol: 'BTCUSDT',
      side: 'BUY',
      type: 'MARKET',
      quantity: '0.001'
    })
    .expect(201);

  expect(response.body.orderId).toBeDefined();
  expect(response.body.status).toBe('FILLED'); // MARKET orders sempre são FILLED imediatamente
  expect(response.body.executedQty).toBe('0.001');
});
```

### 9.2 Teste: Criar Ordem MARKET SELL
```typescript
it('should place a SELL MARKET order', async () => {
  const response = await request(app.getHttpServer())
    .post('/trade/orders')
    .set('Authorization', `Bearer ${jwtToken}`)
    .send({
      symbol: 'BTCUSDT',
      side: 'SELL',
      type: 'MARKET',
      quantity: '0.001'
    })
    .expect(201);

  expect(response.body.orderId).toBeDefined();
  expect(response.body.status).toBe('FILLED');
});
```

### 9.3 Teste: Criar Ordem com USDT (quoteOrderQty)
```typescript
it('should place a BUY MARKET order using quoteOrderQty', async () => {
  const response = await request(app.getHttpServer())
    .post('/trade/orders')
    .set('Authorization', `Bearer ${jwtToken}`)
    .send({
      symbol: 'BTCUSDT',
      side: 'BUY',
      type: 'MARKET',
      quoteOrderQty: '50.00' // Compra R$ 50 de BTC
    })
    .expect(201);

  expect(response.body.orderId).toBeDefined();
  expect(response.body.cumulativeQuoteQty).toBeDefined();
});
```

### 9.4 Teste: Erro - Saldo insuficiente
```typescript
it('should reject order with insufficient balance', async () => {
  const response = await request(app.getHttpServer())
    .post('/trade/orders')
    .set('Authorization', `Bearer ${jwtToken}`)
    .send({
      symbol: 'BTCUSDT',
      side: 'BUY',
      type: 'MARKET',
      quoteOrderQty: '999999.00' // Valor gigante
    })
    .expect(400);

  expect(response.body.message).toContain('insufficient');
});
```

### 9.5 Teste: Consultarhistórico de ordens
```typescript
it('should retrieve order history', async () => {
  // Primeiro coloca uma ordem
  await request(app.getHttpServer())
    .post('/trade/orders')
    .set('Authorization', `Bearer ${jwtToken}`)
    .send({
      symbol: 'BTCUSDT',
      side: 'BUY',
      type: 'MARKET',
      quantity: '0.001'
    });

  // Depois consulta o histórico
  const historyRes = await request(app.getHttpServer())
    .get('/trade/orders')
    .query({ symbol: 'BTCUSDT', limit: 50 })
    .set('Authorization', `Bearer ${jwtToken}`)
    .expect(200);

  expect(historyRes.body.total).toBeGreaterThan(0);
  expect(Array.isArray(historyRes.body.orders)).toBe(true);
});
```

---

## 🚀 10. ROTEIRO DE IMPLEMENTAÇÃO

### **Fase 1: Setup (1 dia)**
- [ ] Criar migration do Prisma para `Order` e `OrderLog` models
- [ ] Gerar tipos do Prisma com `npx prisma generate`
- [ ] Criar `src/trade/trade.module.ts`
- [ ] Criar `src/trade/enums/` (order-side, order-type - apenas MARKET)
- [ ] Criar `src/trade/dto/` com DTOs base (place-order, order-response)

### **Fase 2: Core Service (1-2 dias)**
- [ ] Implementar `TradeService.placeMarketOrder()` com validações
- [ ] Integrar com `BinanceRestClientService` (chamada assinada)
- [ ] Implementar sincronização de timestamp automática
- [ ] Adicionar logging detalhado e auditoria em `OrderLog`
- [ ] Implementar transações Prisma para atomicidade

### **Fase 3: Endpoints REST (1-2 dias)**
- [ ] `POST /trade/orders` - Colocar ordem MARKET
- [ ] `GET /trade/orders/:orderId` - Consultar ordem executada
- [ ] `GET /trade/orders` - Listar histórico de ordens
- [ ] Documentação Swagger de todos os endpoints

### **Fase 4: Testes (1-2 dias)**
- [ ] Testes unitários do `TradeService`
- [ ] Testes E2E dos controllers
- [ ] Testes de integração com testnet Binance
- [ ] Validação de erro handling

### **Fase 5: Validações e Segurança (1 dia)**
- [ ] Validação de saldo antes de BUY
- [ ] Validação contra LOT_SIZE/PRICE_FILTER filters
- [ ] Tratamento de erros Binance específicos
- [ ] Rate limiting / Circuit breaker

### **Fase 6: Documentação (0.5 dias)**
- [ ] README do módulo `trade`
- [ ] Exemplos de uso em cURL e client SDK
- [ ] Guia de troubleshooting

**Total Estimado**: 5-9 dias (bem menos que o plano original de 9-15 dias por focar só em MARKET)

---

## 📌 11. CONSIDERAÇÕES IMPORTANTES

### 11.1 MARKET Orders vs LIMIT Orders
- ✅ **MARKET**: Executa imediatamente ao melhor preço. Status é sempre `FILLED` logo após criação.
  - Não pode ser cancelada (já é executada)
  - Resposta inclui campos `fills` com detalhes de cada fill
  - Recomendado para "compra rápida" sem preocupar com preço exato

- ❌ **LIMIT** (não implementado): Fica pendente até o preço atingir o valor desejado
  - Pode ser cancelada se não totalmente executada
  - Status pode ser `NEW`, `PARTIALLY_FILLED`, `FILLED`
  - Implementação futura quando necessário

### 11.2 Divergência de Horário
- ✅ Já tratado pelo `BinanceRestClientService`
- Sincroniza automaticamente na primeira requisição
- Retry automático se receber `-1021`

### 11.3 Integração com Wallet Module
A wallet **já sincroniza o histórico de trades** via:
- `POST /wallet/sync/trades?symbol=BTCUSDT` - Use para sincronizar
- `GET /wallet/trades` - Para consultar histórico
- `GET /wallet/trades/stats` - Para estatísticas

**NÃO duplicar esta funcionalidade no módulo `trade`.**

### 11.4 Validações Pré-Ordem (Client Side)
Antes de colocar ordem, validar contra:
- ✅ **Credenciais**: Usuário precisa ter credenciais Binance salvas
- ✅ **Saldo**: Verificar se tem saldo suficiente (USDT para BUY)
- ✅ **Quantidade**: Validar contra `LOT_SIZE` filter da Binance
- ✅ **Notional**: Validar quantidade × preço ≥ valor mínimo

### 11.5 Comissões
- Normalmente **0.1% taker** (MARKET é sempre taker)
- **25% desconto** se pagar em BNB
- Retornado no campo `commission` e `commissionAsset`
- Já persistido no modelo `Trade` quando sincronizado

### 11.6 Transações Atômicas
```typescript
// Sempre usar transações para operações multi-tabela
await this.prisma.$transaction([
  this.prisma.order.create({ data: { ... } }),
  this.prisma.orderLog.create({ data: { ... } }),
]);
```

### 11.7 Tratamento de Fills em MARKET Orders
```typescript
// MARKET orders retornam array de fills que podem ser múltiplos
if (binanceResponse.fills && binanceResponse.fills.length > 0) {
  // Persistir cada fill em Trade model
  await this.syncTradesFromFills(tx, userId, binanceResponse.fills);
}
```

---

## 🎓 12. RECURSOS DA API BINANCE

- **Documentação REST**: https://developers.binance.com/docs/binance-spot-api-docs/rest-api/trading-endpoints
- **Errors**: https://developers.binance.com/docs/binance-spot-api-docs/errors
- **Testnet**: https://testnet.binance.vision/

---

## ✅ 13. CHECKLIST PRÉ-DESENVOLVIMENTO

Antes de começar, certifique-se de:
- [ ] Ter acesso à API Binance testnet
- [ ] Ter credenciais testnet salvas no `.env`
- [ ] Ter familiaridade com o `BinanceRestClientService` existente
- [ ] Revisar modelos de dados (Trade, WalletBalance)
- [ ] Revisar padrões de erro do projeto
- [ ] Comunicar timeline com o time

---

## 📞 PRÓXIMAS AÇÕES

1. **Aprovação do Plano**: Revisar e confirmar esta arquitetura
2. **Setup Banco de Dados**: Criar migrations do Prisma
3. **Início da Fase 1**: Criar estrutura do módulo
4. **Testes no Testnet**: Validar antes de produção

---

**Responsável**: @dev-team  
**Data de Início**: 1 de dezembro de 2025  
**Status**: 🟢 Planejamento Completo - Aguardando Aprovação
