import { Controller, Get } from '@nestjs/common';
import { WsAdminService } from './ws-admin.service';

@Controller('ws-admin')
export class WsAdminController {
  constructor(private readonly wsAdminService: WsAdminService) {}

  @Get('status')
  getStatus() {
    return this.wsAdminService.getStatus();
  }
}
