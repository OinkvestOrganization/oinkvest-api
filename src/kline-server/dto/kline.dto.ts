import { ApiProperty } from '@nestjs/swagger';

export class KlineDto {
  @ApiProperty({
    description: 'Tempo de inicio da vela',
    example: 1761742320000,
    type: Number,
  })
  startTime: number;

  @ApiProperty({
    description: 'Preço de abertura da vela',
    example: '113149.98000000',
    type: String,
  })
  openPrice: string;

  @ApiProperty({
    description: 'Maior preço da vela',
    example: '113149.98000000',
    type: String,
  })
  highPrice: string;

  @ApiProperty({
    description: 'Menor preço da vela',
    example: '113149.98000000',
    type: String,
  })
  lowPrice: string;

  @ApiProperty({
    description: 'Preço de fechamento da vela',
    example: '113149.98000000',
    type: String,
  })
  closePrice: string;

  @ApiProperty({
    description: 'Volume de transações da vela',
    example: '113149.98000000',
    type: String,
  })
  volume: string;

  @ApiProperty({
    description: 'Tempo de fechamento da vela',
    example: 1761742379999,
    type: Number,
  })
  closePriceTime: number;

  @ApiProperty({
    description: 'Volume de cotação do ativo',
    example: '294152.25508970',
    type: String,
  })
  quoteAssetVolume: string;

  @ApiProperty({
    description: 'Número de transações',
    example: 3237,
    type: Number,
  })
  numberOfTrades: number;

  @ApiProperty({
    description: 'Volume de compra do ativo base',
    example: '1.33660000',
    type: String,
  })
  takerBuyBaseAssetVolume: string;

  @ApiProperty({
    description: 'Volume de compra do ativo de cotação',
    example: '151231.34730200',
    type: String,
  })
  takerBuyQuoteAssetVolume: string;

  @ApiProperty({
    description: 'Símbolo do par de moedas',
    example: 'BTCUSDT',
    type: String,
  })
  symbol: string;

  @ApiProperty({
    description: 'Intervalo da vela',
    example: '1m',
    type: String,
  })
  interval: string;

  @ApiProperty({
    description: 'Indica se a vela está fechada',
    example: true,
    type: Boolean,
  })
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
