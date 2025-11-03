import { Controller, Get } from '@nestjs/common';
import { BinanceStreamClientService } from './binance-stream-client.service';
import * as streamStatusOutputDto from './dto/stream-status-output.dto';
import { KlineHistoryService } from '@/kline-server/kline-history.service';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('binance-admin')
export class StreamStatusController {
  constructor(
    private readonly binanceStreamClientService: BinanceStreamClientService,
    private readonly klineHistoryService: KlineHistoryService,
  ) {}

  @Get('status')
  @ApiOperation({
    description: 'Dados de conexões por par de moedas.',
    summary: 'Status das conexões com a Binance',
    tags: ['Admin'],
  })
  @ApiResponse({
    status: 200,
    description: 'Status das conexões com a Binance',
    type: streamStatusOutputDto.StreamStatusOutput,
  })
  getStreamStatus(): streamStatusOutputDto.StreamStatusOutput {
    return this.binanceStreamClientService.streamClientStatus();
  }
}
