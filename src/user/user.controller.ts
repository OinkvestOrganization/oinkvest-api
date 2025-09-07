import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { CreateUserDto } from './dto/create-user.dto';
import { UserService } from './user.service';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { ApiBearerAuth } from '@nestjs/swagger';
import { OwnerGuard } from '@/auth/guard/owner.guard';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.createUser(createUserDto);
  }

  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, OwnerGuard) // Proteção da rota
  @ApiBearerAuth() // Usa o Authorize bearer no swagger para testes
  @Get('find/:id')
  findOne(@Param('id') id: string) {
    console.log(`find ID: ${id}`);

    return this.userService.findOne(id);
  }

  findByEmail(@Query('email') email: string) {
    console.log(`find email: ${email}`);

    return this.userService.findByEmail(email);
  }

  @HttpCode(HttpStatus.GONE)
  @UseGuards(JwtAuthGuard, OwnerGuard)
  @ApiBearerAuth()
  @Patch('deactivate/:id')
  deactivate(@Param('id') id: string) {
    console.log(`delete ID: ${id}`);
    return this.userService.deactivate(id);
  }
}
