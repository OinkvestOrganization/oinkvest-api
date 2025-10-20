import { ApiProperty } from '@nestjs/swagger';

export class StreamStatusOutput {
  @ApiProperty({
    example: {
      'btcusdt@kline_1m': 'subscribed',
      'ethusdt@kline_1m': 'subscribed',
    },
    description: 'The pool of subscribed streams.',
  })
  streamPool: Record<string, string>;
}
