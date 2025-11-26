import * as bcrypt from 'bcrypt';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { PrismaService } from '@/prisma/prisma.service';

import { $Enums, User } from '@prisma/client';

@Injectable()
export class UserService {
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
}
