import {
  Body,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
  Get,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ApiOperation } from '@nestjs/swagger';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guard/jwt-auth.guard';
import { AuthRequest } from './dto/AuthRequest';

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
  async login(@Body() loginDto: LoginDto) {
    const result = await this.authService.login(loginDto.email, loginDto.senha);

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

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obter perfil do usuário autenticado',
    description:
      'Retorna o objeto do usuário logado (requer JWT no header/cookie).',
    tags: ['Auth'],
  })
  getProfile(@Req() req: AuthRequest) {
    return {
      user: req.user,
    };
  }
}
