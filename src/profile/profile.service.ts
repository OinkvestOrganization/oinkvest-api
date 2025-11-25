import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AuthRequest } from '@/auth/dto/AuthRequest';
import { Profile } from './entities/profile.entity';
import { UpdatePasswordDto } from './dto/update-password.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ProfileService {
  logger = new Logger(ProfileService.name);
  constructor(private readonly prisma: PrismaService) {}

  profile(request: AuthRequest): Profile {
    return {
      nome: request.user.nome,
      email: request.user.email,
    };
  }

  async updateName(id: string, newName: string) {
    if (newName.trim().length < 4) {
      throw new BadRequestException('O nome deve ter no mínimo 4 caracteres');
    }
    if (newName.trim().length > 50) {
      throw new BadRequestException('O nome deve ter no máximo 50 caracteres');
    }
    // Substituir múltiplos espaços por um único
    const validName = newName.replace(/\s+/g, ' ').trim();

    const updatedName = await this.prisma.user.update({
      where: { id },
      data: { nome: validName },
    });
    return { newName: validName };
  }

  async updatePassword(id: string, updatePassword: UpdatePasswordDto) {
    const { oldPassword, newPassword } = updatePassword;
    this.logger.debug(`Old password: ${oldPassword}`);
    this.logger.debug(`New password: ${newPassword}`);

    this.logger.debug('Checking if user exists...');
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      this.logger.error('User not found');
      throw new BadRequestException('Usuário não encontrado');
    }

    this.logger.debug('Checking if old password is correct...');
    const isPasswordMatching = await bcrypt.compare(oldPassword, user.senha);
    if (!isPasswordMatching) {
      this.logger.error('Old password is incorrect');
      throw new BadRequestException('Senha antiga incorreta');
    }

    this.logger.debug('Updating password...');
    const hash = 10;
    const hashedPassword = await bcrypt.hash(newPassword, hash);

    this.logger.debug('Updating user password...');
    await this.prisma.user.update({
      where: { id },
      data: { senha: hashedPassword },
    });
  }
}
