export interface BinanceSymbol {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
  permissions: string[];
}

export interface BinanceExchangeInfo {
  symbols: BinanceSymbol[];
}
