export interface BinanceSymbol {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
  permissions: string[];
  stepSize?: string; // LOT_SIZE.stepSize
}

export interface BinanceExchangeInfo {
  symbols: BinanceSymbol[];
}
