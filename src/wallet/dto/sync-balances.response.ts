import { ApiProperty } from '@nestjs/swagger';

export class SyncBalancesResponse {
  @ApiProperty({ example: 5, description: 'Quantidade de ativos atualizados' })
  updated: number;
}
