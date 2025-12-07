import * as bcrypt from 'bcrypt';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { PrismaService } from '@/prisma/prisma.service';
import { $Enums, User } from '@prisma/client';
import { UpdatePasswordDto } from '@/profile/dto/update-password.dto';

@Injectable()
export class UserService {
  logger = new Logger(UserService.name);

  constructor(private prisma: PrismaService) {}

  private excluirSenha(user: User): Omit<User, 'senha'> {
    const { senha, ...result } = user;
    return result;
  }

  async createUser(createUserDto: CreateUserDto) {
    const emailExists = await this.prisma.user.findFirst({
      where: { email: createUserDto.email },
    });
    if (emailExists) {
      throw new ConflictException('Email já cadastrado.');
    }

    const salt = 10;
    const hash = bcrypt.hash(createUserDto.senha, salt);
    const user = await this.prisma.user.create({
      data: {
        ...createUserDto,
        senha: await hash,
      },
    });

    return this.excluirSenha(user);
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`Usuário não encontrado.`);
    }

    if (user.status === $Enums.Status.INACTIVE) {
      throw new ConflictException(`Usuário está inativo.`);
    }

    return this.excluirSenha(user);
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    return user;
  }

  async changeName(id: string, newName: string) {
    const user = this.findOne(id);

    if (newName.trim().length < 4) {
      throw new BadRequestException('O nome deve ter no mínimo 4 caracteres');
    }
    if (newName.trim().length > 50) {
      throw new BadRequestException('O nome deve ter no máximo 50 caracteres');
    }

    const validName = newName.replace(/\s+/g, ' ').trim();

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { nome: validName },
    });

    return this.excluirSenha(updatedUser);
  }

  async findByEmail(email: string) {
    const user = await this.prisma.user.findFirst({
      where: { email: email, status: $Enums.Status.ACTIVE },
    });
    if (!user) {
      throw new NotFoundException(`Usuário não encontrado.`);
    }
    if (user.status === $Enums.Status.INACTIVE) {
      throw new UnauthorizedException(`Usuário inativo.`);
    }
    return this.excluirSenha(user);
  }

  async deactivate(id: string) {
    const userExists = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!userExists) {
      throw new NotFoundException(`Usuário não encontrado.`);
    }

    if (userExists.status === $Enums.Status.INACTIVE) {
      throw new ConflictException(`Usuário já está inativo.`);
    }

    const user = await this.prisma.user.update({
      where: { id: id },
      data: {
        status: $Enums.Status.INACTIVE,
        email: '',
        senha: '',
        emailVerificado: null,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    return this.excluirSenha(user);
  }

  async activateUser(user: string) {
    const userExists = await this.prisma.user.findUnique({
      where: { id: user },
    });
    if (!userExists) {
      throw new NotFoundException(`Usuário com ID "${user}" não encontrado.`);
    }
    const userActivated = await this.prisma.user.update({
      where: { id: user },
      data: { emailVerificado: new Date(Date.now()).toISOString() },
    });
    return this.excluirSenha(userActivated);
  }

  async changePassword(id: string, hashedPassword: string) {
    const user = await this.prisma.user.update({
      where: { id: id },
      data: {
        senha: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });
    return this.excluirSenha(user);
  }

  async updatePassword(id: string, updatePassword: UpdatePasswordDto) {
    const { oldPassword, newPassword } = updatePassword;

    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user || user.status === $Enums.Status.INACTIVE) {
      throw new BadRequestException('Usuário não encontrado');
    }

    const isPasswordMatching = await bcrypt.compare(oldPassword, user.senha);
    if (!isPasswordMatching) {
      throw new BadRequestException('Senha antiga incorreta');
    }

    const hash = 10;
    const hashedPassword = await bcrypt.hash(newPassword, hash);

    await this.prisma.user.update({
      where: { id },
      data: { senha: hashedPassword },
    });
  }
}
