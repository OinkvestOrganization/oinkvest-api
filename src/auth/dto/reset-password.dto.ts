import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsStrongPassword } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    name: 'token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOi',
    description: 'Token de autenticação',
  })
  @IsNotEmpty({ message: 'O token é obrigatório.' })
  @IsString({ message: 'O token deve ser uma string.' })
  token: string;

  @ApiProperty({
    name: 'newPassword',
    description: 'Nova senha do usuário',
    example: 'Senha123!',
  })
  @IsNotEmpty({ message: 'A nova senha é obrigatória.' })
  @IsString({ message: 'A nova senha deve ser uma string.' })
  @IsStrongPassword(
    {
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1,
    },
    {
      message:
        'A nova senha deve ter pelo menos 8 caracteres, incluindo letra maiúscula, letra minúscula, caractere especial e número.',
    },
  )
  newPassword: string;
}
