import { Injectable } from '@nestjs/common';
import { KlineServerService } from '@/kline-server/kline-server.service';

@Injectable()
export class WsAdminService {
  constructor(private readonly klineServerService: KlineServerService) {}

  getStatus() {
    return this.klineServerService.getConnectionsStatus();
  }
}
