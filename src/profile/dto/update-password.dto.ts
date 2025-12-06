import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsStrongPassword } from 'class-validator';

export class UpdatePasswordDto {
  @ApiProperty({
    name: 'oldPassword',
    description: 'Senha antiga do usuário',
    example: 'Admin123!',
  })
  @IsNotEmpty({ message: 'A senha antiga é obrigatória.' })
  @IsString({ message: 'A senha antiga deve ser uma string' })
  oldPassword: string;

  @ApiProperty({
    name: 'newPassword',
    description: 'Nova senha do usuário',
    example: 'Senha123!',
  })
  @IsNotEmpty({ message: 'A senha é obrigatória.' })
  @IsString({ message: 'A senha deve ser uma string.' })
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
        'A senha deve ter pelo menos 8 caracteres, incluindo letra maiúscula, letra minúscula, caractere especial e número.',
    },
  )
  newPassword: string;
}
