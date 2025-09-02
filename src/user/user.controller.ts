import { Body, Controller, Get, Patch, Post, Query } from '@nestjs/common';
import type { CreateUserDto } from './dto/create-user.dto';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('create')
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.createUser(createUserDto);
  }

  @Get('find/:id')
  findOne(@Query('id') id: string) {
    console.log(`find ID: ${id}`);

    return this.userService.findOne(id);
  }

  @Get('find/email/:email')
  findByEmail(@Query('email') email: string) {
    console.log(`find email: ${email}`);

    return this.userService.findByEmail(email);
  }

  @Patch('deactivate/:id')
  deactivate(@Query('id') id: string) {
    console.log(`delete ID: ${id}`);
    return this.userService.deactivate(id);
  }
}
