import { Controller, Get } from "@nestjs/common";
import { BinanceStreamClientService } from "./binance-stream-client.service";
import * as streamStatusOutputDto from "./dto/stream-status-output.dto";
import { KlineHistoryService } from "@/kline-server/kline-history.service";

@Controller('stream-status')
export class StreamStatusController {

  constructor(private readonly binanceStreamClientService: BinanceStreamClientService, private readonly klineHistoryService: KlineHistoryService) {}

  @Get()
  getStreamStatus(): streamStatusOutputDto.StreamStatusOutput {
    return this.binanceStreamClientService.streamClientStatus();
  }

  @Get('kline-history')
  getKlineHistory() {
    return this.klineHistoryService.getHistory('btcusdt','1H',10);
  }
}