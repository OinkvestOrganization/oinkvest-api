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
  @IsOptional()
  @IsString()
  asset?: string;

  @ApiPropertyOptional({
    description: 'Filtra por total mínimo',
    example: 0.0001,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  minTotal?: number;

  @ApiPropertyOptional({
    description: 'Quantidade por página',
    example: 100,
    default: 100,
    maximum: 500,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @IsPositive()
  @Max(500)
  take?: number = 100;

  @ApiPropertyOptional({
    description: 'Pular N registros (paginação)',
    example: 0,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  skip?: number = 0;
}
