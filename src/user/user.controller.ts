import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '@/auth/guard/jwt-auth.guard';
import { OwnerGuard } from '@/auth/guard/owner.guard';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('User')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(':id')
  @UseGuards(JwtAuthGuard, OwnerGuard) // <-- Protege a rota
  @ApiOperation({
    summary: 'Buscar usuário por ID',
    description:
      'Retorna os dados de um usuário. (Requer ser o dono do recurso)',
  })
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }
}
