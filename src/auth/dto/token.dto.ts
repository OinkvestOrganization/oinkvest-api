import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class TokenDto {
  @ApiProperty({
    name: 'token',
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lI',
    description: 'Token de autenticação',
  })
  @IsNotEmpty({ message: 'O token é obrigatório.' })
  @IsString({ message: 'O token deve ser uma string.' })
  token: string;
}
