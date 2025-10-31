# Wallet (Spot) – Sincronização de Saldos na Binance

## Objetivo
Implementar a funcionalidade para **buscar os saldos da carteira Spot do usuário na Binance** e **persistir no banco** para análises internas.

## Escopo (MVP)
- **Sincronizar saldos atuais (free/locked) por ativo** da conta Spot.
- Persistir em tabela própria (um registro por `userId + asset`).
- Expor endpoints REST para:
  - Disparar sincronização on-demand.
  - Listar os saldos persistidos.

> Fora do MVP (planejado para evoluções): trades, depósitos/saques, snapshots diários.

## Endpoints Binance (Spot)
Base URL: `https://api.binance.com`

1. **Account info / saldos**
   - `GET /api/v3/account` **(SIGNED)**
   - Retorna `balances[]` com `{ asset, free, locked }`.

2. **Metadados de ativos (opcional – fase 2)**
   - `GET /sapi/v1/capital/config/getall` **(SIGNED)**
   - Informa nome do ativo, se permite depósito/saque e `networkList`.

### Regras de Assinatura (SIGNED)
- Parâmetros obrigatórios: `timestamp=<ms desde epoch>` e, opcionalmente, `recvWindow=5000`.
- `signature = HMAC_SHA256(queryString, apiSecret)`.
- Header: `X-MBX-APIKEY: <apiKey>`.
- A **query assinada deve ser exatamente a query enviada**.

### Exemplo de Query Assinada
timestamp=1730240000000&recvWindow=5000
signature=<hex>


## Fluxo de Sincronização (MVP)
1. Ler credenciais Binance do usuário (armazenadas de forma cifrada).
2. Montar cliente HTTP com:
   - Base URL `https://api.binance.com`
   - Header `X-MBX-APIKEY`
   - Assinatura HMAC de cada requisição SIGNED
3. Chamar `GET /api/v3/account`.
4. Normalizar saldos:
   - `total = free + locked`
   - ignorar ativos com `total = 0` (configurável)
5. **Upsert** em `WalletBalance` por `(userId, asset)`.
6. Registrar auditoria em `WalletSyncLog` (status, timestamps, mensagem).
7. Retornar status da sync e lista resumida dos ativos atualizados.

## Limites de Taxa (Rate Limits)
- Respeitar respostas **HTTP 429/418**:
  - Aplicar **retry com backoff exponencial** e `jitter`.
  - Caso persistam, abortar sync para evitar banimento e logar `BinanceRateLimitError`.

## Tratamento de Erros (Padronização)
- `CredentialMissingError` – usuário sem chave configurada.
- `CredentialInvalidError` – chave/segredo inválidos (Binance `-2014`, `-2015`).
- `BinanceRateLimitError` – 429/418.
- `BinanceServerError` – 5xx.
- `NetworkError` – timeout/DNS etc.

## Variáveis de Ambiente
- `BINANCE_API_URL=https://api.binance.com`
- `APP_ENCRYPTION_KEY=<32 bytes base64/hex>` (para cifrar segredos)
- (posterior) `WALLET_SYNC_CRON=*/15 * * * *` (opcional, agendador)

## Modelagem de Dados (preview – Passo 2)
- `ExchangeCredential`: credenciais Binance cifradas por usuário.
- `WalletBalance`: saldos por ativo (free/locked/total).
- `WalletSyncLog`: logs de execução da sincronização.

## Segurança
- `apiSecret` **nunca** é retornado em claro.
- Dados sensíveis cifrados em repouso (AES-256-GCM).
- Endpoints protegidos por JWT; acesso por `userId` autenticado.

## Critérios de Aceite (MVP)
- [ ] Documento presente em `docs/wallet.md`.
- [ ] Lista de endpoints definida e validada.
- [ ] Fluxo de sync descrito e aceito.
- [ ] Variáveis `.env` mapeadas.
- [ ] Erros e rate limit documentados.

## Próximos Passos
1. **(Passo 2)** Modelagem Prisma (tabelas `ExchangeCredential`, `WalletBalance`, `WalletSyncLog`) e migração.
2. **(Passo 3-5)** Cliente Binance assinado + serviço `syncSpotBalances(userId)`.
3. **(Passo 6)** Controller/DTOs (`POST /wallet/sync/balances`, `GET /wallet/balances`).
4. **(Passo 7+)** Agendador e metadados de ativos.
