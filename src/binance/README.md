# Módulo Binance para NestJS

Este módulo implementa a integração com a API WebSocket da Binance para obter dados de mercado em tempo real.

## Funcionalidades

- Conexão WebSocket com a Binance
- Subscrição em streams de dados (ticker, trades, order book, candles)
- Endpoints SSE (Server-Sent Events) para consumir os dados em tempo real
- Reconexão automática em caso de falha

## Como usar

### 1. Endpoints disponíveis

O módulo expõe os seguintes endpoints SSE:

- **Ticker**: `/binance/ticker/:symbol`
  - Exemplo: `/binance/ticker/btcusdt`
  - Retorna dados de ticker em tempo real para o par de moedas especificado

- **Trades**: `/binance/trades/:symbol`
  - Exemplo: `/binance/trades/btcusdt`
  - Retorna dados de negociações em tempo real para o par de moedas especificado

- **Order Book**: `/binance/orderbook/:symbol?levels=10`
  - Exemplo: `/binance/orderbook/btcusdt?levels=10`
  - Parâmetro `levels`: 5, 10 ou 20 (padrão: 10)
  - Retorna dados do livro de ofertas em tempo real para o par de moedas especificado

- **Candles (Velas)**: `/binance/klines/:symbol?interval=1m`
  - Exemplo: `/binance/klines/btcusdt?interval=1m`
  - Parâmetro `interval`: 1m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 1w, 1M (padrão: 1m)
  - Retorna dados de candles em tempo real para o par de moedas especificado

### 2. Consumindo os dados via SSE

Você pode consumir os dados usando a API EventSource no frontend:

```javascript
// Exemplo de como consumir o endpoint de ticker
const eventSource = new EventSource('http://localhost:3000/binance/ticker/btcusdt');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Ticker data:', data);
  // Processar os dados recebidos
};

eventSource.onerror = (error) => {
  console.error('SSE Error:', error);
  eventSource.close();
};
```

### 3. Usando o serviço diretamente

Se você precisar usar o serviço da Binance diretamente em outro módulo, você pode injetá-lo:

```typescript
import { Injectable } from '@nestjs/common';
import { BinanceService } from '../binance/binance.service';

@Injectable()
export class SeuServico {
  constructor(private readonly binanceService: BinanceService) {}

  async obterDadosBitcoin() {
    // Exemplo de como subscrever em um stream de ticker
    this.binanceService.subscribeTicker('btcusdt', (data) => {
      console.log('Dados do ticker do Bitcoin:', data);
      // Processar os dados recebidos
    });
  }
}
```

## Estrutura do módulo

- `binance.module.ts` - Definição do módulo
- `binance.service.ts` - Serviço para conexão WebSocket e subscrição em streams
- `binance.controller.ts` - Controlador que expõe os endpoints SSE
- `interfaces/binance-websocket.interfaces.ts` - Interfaces para os dados recebidos

## Próximos passos

Para expandir este módulo, você pode:

1. Implementar a API REST da Binance para operações que exigem autenticação
2. Adicionar suporte para mais streams de dados
3. Implementar cache de dados para reduzir a carga no servidor
4. Adicionar suporte para múltiplas conexões WebSocket para melhor desempenho