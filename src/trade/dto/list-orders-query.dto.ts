import { IsString, IsOptional, IsNumber, Min } from 'class-validator';

export class ListOrdersQueryDto {
  @IsString()
  symbol: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number = 100;

  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;
}
