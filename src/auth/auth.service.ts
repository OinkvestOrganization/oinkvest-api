import { UserService } from '@/user/user.service';
import {
  ConflictException,
  // ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '@/user/dto/create-user.dto';
import { EmailService } from '@/email/email.service';
// import { randomUUID } from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UserService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private prisma: PrismaService,
  ) {}

  async register(createUserDto: CreateUserDto) {
    await this.usersService.createUser(createUserDto);
    // const user = await this.usersService.createUser(createUserDto);
    // const token = randomUUID();
    // const expiresIn = new Date(Date.now() + 1000 * 60 * 60 * 24);

    // const verificationToken = await this.prisma.verificationToken.create({
    //   data: {
    //     token: token,
    //     expires: expiresIn,
    //     userId: user.id,
    //   },
    // });

    // await this.emailService.sendVerificationEmail(
    //   user.email,
    //   verificationToken.token,
    //   user.nome,
    // );
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
        'Conta ainda não verificada. Por favor verifique seu e-mail.',
      );
    }

    const payload = { sub: user.id, email: user.email };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
      },
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
}
