import {
  Controller,
  Get,
  Put,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { ProfileService } from './profile.service';
import { JwtAuthGuard } from '@/auth/guard/jwt-auth.guard';
import { AuthRequest } from '@/auth/dto/AuthRequest';

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
}
