import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AuthRequest } from '@/auth/dto/AuthRequest';
import { Profile } from './entities/profile.entity';
import { UpdatePasswordDto } from './dto/update-password.dto';
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
      await this.userService.changeName(id, newName);
      return { message: 'Nome de usuário alterado com sucesso.' };
    } catch (error) {
      this.logger.error(error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(error);
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

  async disableAccount(id: string) {
    try {
      await this.userService.deactivate(id);
      return { message: 'Conta desativada com sucesso.' };
    } catch (error) {
      this.logger.error(error);
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(error);
    }
  }
}
