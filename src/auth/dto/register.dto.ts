import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsStrongPassword,
  Length,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    name: 'nome',
    description: 'Nome e sobrenome do usuário.',
    example: 'João da Silva',
  })
  @IsNotEmpty({ message: 'O nome é obrigatório.' })
  @IsString({ message: 'O nome deve ser uma string.' })
  @Length(3, 100)
  nome: string;

  @ApiProperty({
    name: 'email',
    description: 'Endereço de e-mail do usuário.',
    example: 'joao.silva@email.com',
  })
  @IsNotEmpty({ message: 'O e-mail é obrigatório.' })
  @IsEmail({}, { message: 'O e-mail deve ser válido.' })
  email: string;

  @ApiProperty({
    name: 'senha',
    description: 'Senha de acesso do usuário.',
    example: 'Senha12345',
  })
  @IsNotEmpty({ message: 'A senha é obrigatória.' })
  @IsString({ message: 'A senha deve ser uma string.' })
  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
  },
  {
    message:
      'A senha deve ter pelo menos 8 caracteres, incluindo letra maiúscula, letra minúscula, caractere especial e número.',
  },)
  senha: string;
}
