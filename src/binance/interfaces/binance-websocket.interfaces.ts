/**
 * Interfaces para os dados recebidos via WebSocket da Binance
 */

// Interface para dados de ticker
export interface BinanceTickerData {
  e: string;              // Tipo de evento
  E: number;              // Timestamp do evento
  s: string;              // Símbolo
  p: string;              // Mudança de preço
  P: string;              // Mudança de preço em percentual
  w: string;              // Preço médio ponderado
  x: string;              // Preço do primeiro negócio
  c: string;              // Preço do último negócio
  Q: string;              // Quantidade do último negócio
  b: string;              // Melhor preço de compra
  B: string;              // Melhor quantidade de compra
  a: string;              // Melhor preço de venda
  A: string;              // Melhor quantidade de venda
  o: string;              // Preço de abertura
  h: string;              // Preço mais alto
  l: string;              // Preço mais baixo
  v: string;              // Volume total
  q: string;              // Volume em valor da moeda base
  O: number;              // Timestamp de abertura
  C: number;              // Timestamp de fechamento
  F: number;              // ID do primeiro negócio
  L: number;              // ID do último negócio
  n: number;              // Número de negócios
}

// Interface para dados de negociações
export interface BinanceTradeData {
  e: string;              // Tipo de evento
  E: number;              // Timestamp do evento
  s: string;              // Símbolo
  t: number;              // ID do negócio
  p: string;              // Preço
  q: string;              // Quantidade
  b: number;              // ID da ordem de compra
  a: number;              // ID da ordem de venda
  T: number;              // Timestamp do negócio
  m: boolean;             // É o comprador o market maker?
  M: boolean;             // Ignorar
}

// Interface para dados de book de ofertas
export interface BinanceOrderBookData {
  lastUpdateId: number;   // ID da última atualização
  bids: [string, string][]; // Ofertas de compra [preço, quantidade]
  asks: [string, string][]; // Ofertas de venda [preço, quantidade]
}

// Interface para dados de candles (velas)
export interface BinanceKlineData {
  e: string;              // Tipo de evento
  E: number;              // Timestamp do evento
  s: string;              // Símbolo
  k: {
    t: number;            // Timestamp de abertura da vela
    T: number;            // Timestamp de fechamento da vela
    s: string;            // Símbolo
    i: string;            // Intervalo
    f: number;            // ID do primeiro negócio
    L: number;            // ID do último negócio
    o: string;            // Preço de abertura
    c: string;            // Preço de fechamento
    h: string;            // Preço mais alto
    l: string;            // Preço mais baixo
    v: string;            // Volume
    n: number;            // Número de negócios
    x: boolean;           // Vela fechada?
    q: string;            // Volume em valor da moeda base
    V: string;            // Volume do comprador
    Q: string;            // Volume em valor do comprador
    B: string;            // Ignorar
  };
}

// Interface para resposta de subscrição
export interface BinanceSubscriptionResponse {
  result: null;
  id: number;
}

// Interface para mensagem de stream combinada
export interface BinanceCombinedStreamMessage<T> {
  stream: string;
  data: T;
}