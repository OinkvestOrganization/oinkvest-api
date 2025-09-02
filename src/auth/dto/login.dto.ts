import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example: 'usuario@email.com',
    description: 'O e-mail de login do usuário.',
  })
  email: string;

  @ApiProperty({
    example: 'senhaForte123',
    description: 'A senha de acesso do usuário.',
  })
  senha: string;
}
