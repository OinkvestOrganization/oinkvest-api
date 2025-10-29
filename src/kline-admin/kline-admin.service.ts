import { Injectable } from '@nestjs/common';
import { KlineServerService } from '@/kline-server/kline-server.service';
import { KlineStatusDto } from '@/kline-server/dto/kline-status.dto';

@Injectable()
export class KlineAdminService {
  constructor(private readonly klineServerService: KlineServerService) {}

  getStatus(): KlineStatusDto {
    return this.klineServerService.getConnectionsStatus();
  }
}
