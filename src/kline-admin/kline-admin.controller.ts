import { Controller, Get } from '@nestjs/common';
import { KlineAdminService } from './kline-admin.service';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { KlineStatusDto } from '@/kline-server/dto/kline-status.dto';

@Controller('kline-admin')
export class KlineAdminController {
  constructor(private readonly KlineAdminService: KlineAdminService) {}

  @Get('status')
  @ApiOperation({
    description: 'Dados de conexões por par de moedas.',
    summary: 'Status das conexões para klines',
    tags: ['Admin'],
  })
  @ApiResponse({
    status: 200,
    description: 'Status das conexões para klines',
    type: KlineStatusDto,
  })
  getStatus(): KlineStatusDto {
    return this.KlineAdminService.getStatus();
  }
}
