import { Injectable } from '@nestjs/common';
import { WsServerService } from '@/ws-server/ws-server.service';

@Injectable()
export class WsAdminService {
  constructor(private readonly wsServerService: WsServerService) {}

  getStatus() {
    return this.wsServerService.getConnectionsStatus();
  }
}
