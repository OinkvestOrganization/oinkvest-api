import { UserService } from '@/user/user.service';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '@/user/dto/create-user.dto';
import { EmailService } from '@/email/email.service';
import { randomUUID } from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { ResetPasswordDto } from './dto/reset-password.dot';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { $Enums } from '@prisma/client';

@Injectable()
export class AuthService {
  logger = new Logger(AuthService.name);
  constructor(
    private usersService: UserService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
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

    if (user.status === $Enums.Status.INACTIVE) {
      throw new UnauthorizedException('Credenciais inválidas.');
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
    const cachedEmail = await this.cacheManager.get('forgot-email-' + email);
    if (cachedEmail) {
      throw new BadRequestException(
        'Você solicitou recentemente uma redefinição de senha. Por favor, aguarde um minuto antes de tentar novamente.',
      );
    }
    const minute = 60000;

    this.cacheManager.set('forgot-email-' + email, email, minute);

    const user = await this.usersService.findByEmail(email);

    // Envio de mensagem de sucesso mesmo após falha para evitar enumeração de email
    if (!user || !user.emailVerificado) {
      return {
        message:
          'Se um usuário com este e-mail existir e for verificado, um link para redefinição de senha será enviado.',
      };
    }

    const token = randomUUID();
    const expiresIn = new Date(Date.now() + 1000 * 60 * 10); // 10 minutes

    await this.emailService.sendPasswordResetEmail(user.email, token);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetExpires: expiresIn,
      },
    });

    return {
      message:
        'Se um usuário com este e-mail existir e for verificado, um link para redefinição de senha será enviado.',
    };
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

    try {
      await this.usersService.changePassword(user.id, hashedPassword);
    } catch (error) {
      this.logger.error(error);
      throw new InternalServerErrorException(error);
    }
    return { message: 'Senha redefinida com sucesso.' };
  }

  async disableAccount(id: string) {
    try {
      await this.usersService.deactivate(id);
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
