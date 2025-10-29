import { ApiProperty } from '@nestjs/swagger';

export class KlineStatusDto {
  @ApiProperty({
    description: 'Total de conexões ativas',
    example: 10,
  })
  totalConnections: number;

  @ApiProperty({
    description: 'Total de streams ativas',
    example: 5,
  })
  activeStreamsCount: number;

  @ApiProperty({
    description: 'Streams ativas',
    example: {
      'BTCUSDT@kline_1m': {
        subscriberCount: 5,
        subscribers: ['client1', 'client2'],
      },
      'ETHUSDT@kline_1m': {
        subscriberCount: 3,
        subscribers: ['client3', 'client4', 'client5'],
      },
    },
  })
  activeStreams: object;
}
