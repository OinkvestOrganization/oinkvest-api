import {
  Controller,
  Get,
  Put,
  UseGuards,
  Req,
  Query,
  Body,
  HttpStatus,
  Delete,
  Res,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { ProfileService } from './profile.service';
import { JwtAuthGuard } from '@/auth/guard/jwt-auth.guard';
import { AuthRequest } from '@/auth/dto/AuthRequest';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Profile } from './entities/profile.entity';
import type { Response } from 'express';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @ApiOperation({
    summary: 'Obter perfil do usuário autenticado',
    description:
      'Retorna o objeto do usuário logado (requer JWT no header/cookie).',
    tags: ['Profile'],
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Objeto do usuário logado.',
    type: Profile,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Usuário não autenticado.',
  })
  @UseGuards(JwtAuthGuard)
  @Get()
  async profile(@Req() req: AuthRequest, @Res() res: Response) {
    const profile = this.profileService.profile(req);
    res.status(HttpStatus.OK).json(profile);
  }

  @ApiOperation({
    summary: 'Alterar nome de usuário',
    description: 'Rota para alterar o nome de usuário.',
    tags: ['Profile'],
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Nome de usuário alterado com sucesso.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Nome de usuário inválido.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Usuário não autenticado.',
  })
  @UseGuards(JwtAuthGuard)
  @Put()
  updateName(
    @Req() req: AuthRequest,
    @Query('newName') newName: string,
    @Res() res: Response,
  ) {
    const updatedName = this.profileService.updateName(req.user.id, newName);
    res.status(HttpStatus.CREATED).json(updatedName);
  }

  @ApiOperation({
    summary: 'Alterar senha de usuário',
    description: 'Rota para alterar a senha de usuário.',
    tags: ['Profile'],
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Senha alterada com sucesso.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Senha inválida.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Usuário não autenticado.',
  })
  @UseGuards(JwtAuthGuard)
  @Put('update-password')
  remove(
    @Req() req: AuthRequest,
    @Body() updatePassword: UpdatePasswordDto,
    @Res() res: Response,
  ) {
    const updatedPassword = this.profileService.updatePassword(
      req.user.id,
      updatePassword,
    );
    res.status(HttpStatus.CREATED).json(updatedPassword);
  }

  @ApiOperation({
    summary: 'Desativar conta de usuário',
    description: 'Rota para desativar a conta de usuário.',
    tags: ['Profile'],
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Conta desativada com sucesso.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Usuário não autenticado.',
  })
  @UseGuards(JwtAuthGuard)
  @Delete('disable-account')
  disableAccount(@Req() req: AuthRequest, @Res() res: Response) {
    const disabledAccount = this.profileService.disableAccount(req.user.id);
    res.status(HttpStatus.CREATED).json(disabledAccount);
  }
}
