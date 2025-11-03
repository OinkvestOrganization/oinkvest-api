import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Max, Min, IsOptional } from 'class-validator';

class KlineSubscriptionDto {
  @ApiProperty({
    example: 'BTCUSDT',
    description: 'Nome do par de ativos',
  })
  symbol: string;

  @ApiProperty({
    example: '1h',
    description: 'Intervalo de klines',
  })
  interval: string;

  @IsOptional()
  @Min(1)
  @Max(1000)
  @IsNumber()
  @ApiProperty({
    default: 1,
    example: 10,
    description: 'Numero de velas a ser retornada no momento da inscrição.',
  })
  limit: number;
}
export default KlineSubscriptionDto;
export { KlineSubscriptionDto };
