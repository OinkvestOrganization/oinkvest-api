import {
  Body,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  Query,
  Res,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ApiOperation } from '@nestjs/swagger';
import { RegisterDto } from './dto/register.dto';
import type { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @HttpCode(HttpStatus.CREATED)
  @Post('register')
  @ApiOperation({
    summary: 'Cadastro',
    description: 'Rota para cadastros de usuários.',
    tags: ['Auth'],
  })
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login',
    description: 'Rota para login de usuários.',
    tags: ['Auth'],
  })
  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(loginDto.email, loginDto.senha);

    // Define o cookie
    response.cookie('access_token', result.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600 * 1000, // 1 hora
    });
    return { access_token: result.access_token, user: result.user };
  }

  @HttpCode(HttpStatus.CREATED)
  @Post('verify')
  @ApiOperation({
    summary: 'Verificação de email',
    description: 'Rota para verificação de email de usuários.',
    tags: ['Auth'],
  })
  verify(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }
}
