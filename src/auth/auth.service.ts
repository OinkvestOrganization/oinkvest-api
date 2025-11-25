import { UserService } from '@/user/user.service';
import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '@/user/dto/create-user.dto';
import { EmailService } from '@/email/email.service';
import { randomUUID } from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { ResetPasswordDto } from './dto/reset-password.dot';

@Injectable()
export class AuthService {
  logger = new Logger(AuthService.name);
  constructor(
    private usersService: UserService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private prisma: PrismaService,
  ) {}

  async register(createUserDto: CreateUserDto) {
    const user = await this.usersService.createUser(createUserDto);
    const token = randomUUID();
    const expiresIn = new Date(Date.now() + 1000 * 60 * 60 * 24);

    const verificationToken = await this.prisma.verificationToken.create({
      data: {
        token: token,
        expires: expiresIn,
        userId: user.id,
      },
    });

    await this.emailService.sendVerificationEmail(
      user.email,
      verificationToken.token,
      user.nome,
    );
    return {
      message:
        'Cadastro realizado com sucesso. Verifique seu e-mail para ativar sua conta.',
    };
  }

  async login(email: string, pass: string) {
    const userFound = await this.usersService.findByEmail(email);
    const user = await this.usersService.findById(userFound.id);

    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const isPasswordMatching = await bcrypt.compare(pass, user.senha);

    if (!isPasswordMatching) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    if (!user.emailVerificado) {
      throw new ConflictException(
        'Conta ainda não verificada. Por favor, verifique seu e-mail.',
      );
    }

    const payload = { sub: user.id, email: user.email };

    return {
      user: { id: user.id, nome: user.nome, email: user.email },
      access_token: this.jwtService.sign(payload),
    };
  }

  async verifyEmail(token: string) {
    const record = await this.prisma.verificationToken.findUnique({
      where: { token: token },
    });
    if (!record) {
      throw new UnauthorizedException('Token inválido.');
    }
    if (record.expires.getTime() < Date.now()) {
      await this.prisma.verificationToken.delete({ where: { id: record.id } });
      await this.prisma.user.delete({ where: { id: record.userId } });
      throw new UnauthorizedException('Token expirado. Realize novo cadastro.');
    }
    await this.usersService.activateUser(record.userId);
    return { message: 'Email verificado com sucesso.' };
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      this.logger.error('User not found');
      throw new UnauthorizedException('Usuário não encontrado.');
    }
    this.logger.debug('User found' + user);
    const token = randomUUID();
    const expiresIn = new Date(Date.now() + 1000 * 60 * 60 * 24);

    this.logger.debug(`Token created: ${token}`);
    this.logger.debug(`Expires in: ${expiresIn}`);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetExpires: expiresIn,
      },
    });

    this.logger.debug('Token hashed, sending email...');
    this.emailService.sendPasswordResetEmail(user.email, token);
    return { message: 'Email de redefinição de senha enviado com sucesso.' };
  }

  async resetPassword(resetPassword: ResetPasswordDto) {
    const { token, newPassword } = resetPassword;

    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: {
          gte: new Date(),
        },
      },
    });

    if (!user) {
      this.logger.error('Token inválido');
      return;
    }

    const salt = 10;
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        senha: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });
    return { message: 'Senha redefinida com sucesso.' };
  }
}
