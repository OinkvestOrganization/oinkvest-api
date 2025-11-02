import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class ListBalancesQueryDto {
  @ApiPropertyOptional({
    description: 'Filtra por símbolo do ativo',
    example: 'USDT',
  })
  @IsString()
  @IsOptional()
  asset?: string;

  @ApiPropertyOptional({
    description: 'Filtra por total mínimo',
    example: 0.0001,
  })
  @Transform(({ value }) =>
    value === undefined || value === '' ? undefined : Number(value),
  )
  @IsNumber()
  @Min(0)
  @IsOptional()
  minTotal?: number;

  @ApiPropertyOptional({
    description: 'Quantidade por página',
    example: 100,
    default: 100,
    maximum: 500,
  })
  @Transform(({ value }) => Number(value))
  @IsInt()
  @IsPositive()
  @Max(500)
  @IsOptional()
  take?: number = 100;

  @ApiPropertyOptional({
    description: 'Pular N registros (paginação)',
    example: 0,
  })
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  @IsOptional()
  skip?: number = 0;
}
