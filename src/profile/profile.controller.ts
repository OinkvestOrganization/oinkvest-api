import {
  Controller,
  Get,
  Put,
  UseGuards,
  Req,
  Query,
  Body,
} from '@nestjs/common';
import { ProfileService } from './profile.service';
import { JwtAuthGuard } from '@/auth/guard/jwt-auth.guard';
import { AuthRequest } from '@/auth/dto/AuthRequest';
import { UpdatePasswordDto } from './dto/update-password.dto';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async profile(@Req() req: AuthRequest) {
    return this.profileService.profile(req);
  }

  @UseGuards(JwtAuthGuard)
  @Put()
  updateName(@Req() req: AuthRequest, @Query('newName') newName: string) {
    return this.profileService.updateName(req.user.id, newName);
  }

  @UseGuards(JwtAuthGuard)
  @Put('update-password')
  remove(@Req() req: AuthRequest, @Body() updatePassword: UpdatePasswordDto) {
    return this.profileService.updatePassword(req.user.id, updatePassword);
  }
}
