import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CreateSupportDto {
  @IsNotEmpty({ message: 'O assunto é obrigatório.' })
  @IsString()
  @Length(10, 255, { message: 'O assunto deve ter entre 10 e 255 caracteres' })
  subject: string;

  @IsNotEmpty({ message: 'A mensagem é obrigatória.' })
  @IsString()
  @Length(10, 5000, {
    message: 'A mensagem deve ter entre 10 e 5000 caracteres.',
  })
  message: string;
}
