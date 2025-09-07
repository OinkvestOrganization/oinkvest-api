import * as bcrypt from 'bcrypt'; /* eslint-disable @typescript-eslint/no-unused-vars */
// user.service.ts

import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';
// Importação corrigida
import { User } from '@prisma/client';

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
      throw new NotFoundException(`Usuário com ID "${id}" não encontrado.`);
    }

    if (user.status === false) {
      throw new ConflictException(`Usuário com ID "${id}" está inativo.`);
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
      where: { email: email, status: true },
    });
    if (!user) {
      throw new NotFoundException(
        `Usuário com email "${email}" não encontrado.`,
      );
    }
    if (user.status == false) {
      throw new ConflictException(`Usuário com email "${email}" está inativo.`);
    }
    return this.excluirSenha(user);
  }

  async deactivate(id: string) {
    const userExists = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!userExists) {
      throw new NotFoundException(`Usuário com ID "${id}" não encontrado.`);
    }

    if (userExists.status == false) {
      throw new ConflictException(`Usuário com ID "${id}" já está inativo.`);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: { status: false },
    });
    return this.excluirSenha(user);
  }

  async activateUser (user: string) {
    const userExists = await this.prisma.user.findUnique({where: {id: user}});
    if (!userExists) {
      throw new NotFoundException(`Usuário com ID "${user}" não encontrado.`);
    }
    const userActivated = await this.prisma.user.update({where: {id: user}, data: {emailVerificado: new Date(Date.now()).toLocaleDateString()}});
    return this.excluirSenha(userActivated);
  }
}
