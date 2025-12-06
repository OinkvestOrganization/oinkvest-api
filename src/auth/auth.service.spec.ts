import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { AuthService } from './auth.service';

// Mocks
const mockUserService = {
  createUser: jest.fn(),
  findByEmail: jest.fn(),
  findById: jest.fn(),
  activateUser: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mockedAccessToken'),
};

const mockEmailService = {
  sendVerificationEmail: jest.fn(),
};

const mockPrismaService = {
  verificationToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
  user: {
    delete: jest.fn(),
  },
};

// Mock do bcrypt
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('hashedPassword'),
}));

// Mock do randomUUID
jest.mock('crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('mocked-uuid-token'),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prisma: typeof mockPrismaService;

  const mockUserWithoutPassword = {
    id: 'user-id-1',
    email: 'test@example.com',
    nome: 'Test User',
    status: true,
    emailVerificado: new Date().toISOString(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUser = {
    ...mockUserWithoutPassword,
    senha: 'hashedPassword',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: mockUserService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  it('deve ser definido', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    /*
    it('deve registrar um novo usuário e enviar email de verificação', async () => {
      mockUserService.createUser.mockResolvedValue(mockUserWithoutPassword);
      prisma.verificationToken.create.mockResolvedValue({
        token: 'mocked-uuid-token',
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24),
        userId: mockUser.id,
      });

      const result = await service.register(createUserDto as any);

      expect(mockUserService.createUser).toHaveBeenCalledWith(createUserDto);
      expect(randomUUID).toHaveBeenCalled();
      expect(prisma.verificationToken.create).toHaveBeenCalled();
      expect(mockEmailService.sendVerificationEmail).toHaveBeenCalledWith(
        mockUser.email,
        'mocked-uuid-token',
        mockUser.nome,
      );
      expect(result).toEqual({
        message:
          'Cadastro realizado com sucesso. Verifique seu e-mail para ativar sua conta.',
      });
    });
    */
  });

  describe('login', () => {
    const email = 'test@example.com';
    const password = 'password123';

    it('deve retornar um access_token para credenciais válidas e conta verificada', async () => {
      mockUserService.findByEmail.mockResolvedValue(mockUserWithoutPassword);
      mockUserService.findById.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(email, password);

      expect(mockUserService.findByEmail).toHaveBeenCalledWith(email);
      expect(mockUserService.findById).toHaveBeenCalledWith(mockUser.id);
      expect(bcrypt.compare).toHaveBeenCalledWith(password, mockUser.senha);
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
      });
      expect(result).toEqual({ access_token: 'mockedAccessToken' });
    });

    it('deve lançar UnauthorizedException se a senha estiver incorreta', async () => {
      mockUserService.findByEmail.mockResolvedValue(mockUserWithoutPassword);
      mockUserService.findById.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(email, password)).rejects.toThrow(
        UnauthorizedException,
      );
    });
    /*
    it('deve lançar ConflictException se a conta não estiver verificada', async () => {
      const unverifiedUser = { ...mockUser, emailVerificado: null };
      mockUserService.findByEmail.mockResolvedValue(mockUserWithoutPassword);
      mockUserService.findById.mockResolvedValue(unverifiedUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login(email, password)).rejects.toThrow(
        ConflictException,
      );
    });
    */
    it('deve lançar UnauthorizedException se o usuário não for encontrado após findByEmail (caso de erro)', async () => {
      mockUserService.findByEmail.mockResolvedValue(mockUserWithoutPassword);
      mockUserService.findById.mockResolvedValue(null);

      await expect(service.login(email, password)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('verifyEmail', () => {
    const token = 'valid-token';
    const expiredToken = 'expired-token';
    const invalidToken = 'invalid-token';

    const mockVerificationRecord = {
      id: 'record-id',
      token: token,
      expires: new Date(Date.now() + 1000 * 60 * 60), // 1 hora no futuro
      userId: mockUser.id,
    };

    it('deve verificar o email com sucesso para um token válido', async () => {
      prisma.verificationToken.findUnique.mockResolvedValue(
        mockVerificationRecord,
      );
      mockUserService.activateUser.mockResolvedValue(mockUserWithoutPassword);

      const result = await service.verifyEmail(token);

      expect(prisma.verificationToken.findUnique).toHaveBeenCalledWith({
        where: { token: token },
      });
      expect(mockUserService.activateUser).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual({ message: 'Email verificado com sucesso.' });
    });

    it('deve lançar UnauthorizedException para um token inválido', async () => {
      prisma.verificationToken.findUnique.mockResolvedValue(null);

      await expect(service.verifyEmail(invalidToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('deve lançar UnauthorizedException e deletar o usuário/token para um token expirado', async () => {
      const expiredRecord = {
        ...mockVerificationRecord,
        token: expiredToken,
        expires: new Date(Date.now() - 1000), // 1 segundo no passado
      };
      prisma.verificationToken.findUnique.mockResolvedValue(expiredRecord);
      prisma.verificationToken.delete.mockResolvedValue(expiredRecord);
      mockPrismaService.verificationToken.delete.mockResolvedValue(
        expiredRecord,
      );
      mockPrismaService.user.delete.mockResolvedValue(mockUser);

      await expect(service.verifyEmail(expiredToken)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.verificationToken.delete).toHaveBeenCalledWith({
        where: { id: expiredRecord.id },
      });
      expect(mockPrismaService.user.delete).toHaveBeenCalledWith({
        where: { id: expiredRecord.userId },
      });
    });
  });
});
