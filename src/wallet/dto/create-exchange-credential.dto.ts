import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class CreateExchangeCredentialDto {
  @ApiProperty({
    description: 'Chave pública da exchange (API Key)',
    example: 'b6c23f4d0a8f9c1a3f...',
    minLength: 5,
    maxLength: 100,
  })
  @IsString()
  @Length(5, 100)
  apiKey: string;

  @IsString()
  @Length(5, 100)
  apiSecret: string;
}
