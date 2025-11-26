import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AuthRequest } from '@/auth/dto/AuthRequest';
import { Profile } from './entities/profile.entity';
import { UpdatePasswordDto } from './dto/update-password.dto';
import * as bcrypt from 'bcrypt';
import { UserService } from '@/user/user.service';

@Injectable()
export class ProfileService {
  logger = new Logger(ProfileService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
  ) {}

  profile(request: AuthRequest): Profile {
    return {
      nome: request.user.nome,
      email: request.user.email,
    };
  }

  async updateName(id: string, newName: string) {
    try {
      return await this.userService.changeName(id, newName);
    } catch (error) {
      this.logger.error(error);
      throw new BadRequestException(error);
    }
  }

  async updatePassword(id: string, updatePassword: UpdatePasswordDto) {
    try {
      return this.userService.updatePassword(id, updatePassword);
    } catch (error) {
      this.logger.error(error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(error);
    }
  }
}
