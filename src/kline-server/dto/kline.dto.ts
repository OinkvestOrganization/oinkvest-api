export class KlineDto {
  startTime: number;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  closePrice: string;
  volume: string;
  closePriceTime: number;
  quoteAssetVolume: string;
  numberOfTrades: number;
  takerBuyBaseAssetVolume: string;
  takerBuyQuoteAssetVolume: string;
  symbol: string;
  interval: string;
  closed: boolean;

  static fromBinance(data: any): KlineDto {
    const dto = new KlineDto();
    dto.startTime = data.t;
    dto.openPrice = data.o;
    dto.highPrice = data.h;
    dto.lowPrice = data.l;
    dto.closePrice = data.c;
    dto.volume = data.v;
    dto.closePriceTime = data.T;
    dto.quoteAssetVolume = data.q;
    dto.numberOfTrades = data.n;
    dto.takerBuyBaseAssetVolume = data.V;
    dto.takerBuyQuoteAssetVolume = data.Q;
    dto.symbol = data.s;
    dto.interval = data.i;
    dto.closed = data.x;
    return dto;
  }

  static fromHistory(data: any[], symbol: string, interval: string): KlineDto {
    const dto = new KlineDto();
    dto.startTime = data[0];
    dto.openPrice = data[1];
    dto.highPrice = data[2];
    dto.lowPrice = data[3];
    dto.closePrice = data[4];
    dto.volume = data[5];
    dto.closePriceTime = data[6];
    dto.quoteAssetVolume = data[7];
    dto.numberOfTrades = data[8];
    dto.takerBuyBaseAssetVolume = data[9];
    dto.takerBuyQuoteAssetVolume = data[10];
    dto.symbol = symbol;
    dto.interval = interval;
    dto.closed = true;
    return dto;
  }
}
