import { BadRequestException, Injectable } from '@nestjs/common';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PrismaService } from '@/prisma/prisma.service';
import { AuthRequest } from '@/auth/dto/AuthRequest';
import { Profile } from './entities/profile.entity';

@Injectable()
export class ProfileService {
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

  remove(id: number) {
    return `This action removes a #${id} profile`;
  }
}
