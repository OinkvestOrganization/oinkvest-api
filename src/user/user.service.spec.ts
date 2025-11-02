import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';

// Mock do PrismaService
const mockPrismaService = {
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

// Mock do bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashedPassword'),
  compare: jest.fn(),
}));

describe('UserService', () => {
  let service: UserService;
  let prisma: typeof mockPrismaService;

  const mockUser: User = {
    id: 'user-id-1',
    email: 'test@example.com',
    nome: 'Test User',
    senha: 'hashedPassword',
    status: true,
    emailVerificado: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserWithoutPassword = (({ senha, ...rest }) => rest)(mockUser);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  it('deve ser definido', () => {
    expect(service).toBeDefined();
  });

  describe('createUser', () => {
    const createUserDto = {
      email: 'new@example.com',
      nome: 'New User',
      senha: 'password123',
    };

    it('deve criar um novo usuário com sucesso', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser);

      const result = await service.createUser(createUserDto);

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: createUserDto.email },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(createUserDto.senha, 10);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          ...createUserDto,
          senha: 'hashedPassword',
        },
      });
      expect(result).toEqual(mockUserWithoutPassword);
    });

    it('deve lançar ConflictException se o email já estiver cadastrado', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);

      await expect(service.createUser(createUserDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findOne', () => {
    it('deve retornar um usuário ativo com sucesso', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findOne(mockUser.id);

      expect(result).toEqual(mockUserWithoutPassword);
    });

    it('deve lançar NotFoundException se o usuário não for encontrado', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deve lançar ConflictException se o usuário estiver inativo (status: false)', async () => {
      const inactiveUser = { ...mockUser, status: false };
      prisma.user.findUnique.mockResolvedValue(inactiveUser);

      await expect(service.findOne(mockUser.id)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findByEmail', () => {
    it('deve retornar um usuário ativo por email com sucesso', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);

      const result = await service.findByEmail(mockUser.email);

      expect(result).toEqual(mockUserWithoutPassword);
    });

    it('deve lançar NotFoundException se o usuário não for encontrado', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.findByEmail('non-existent@email.com'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivate', () => {
    it('deve desativar um usuário ativo com sucesso', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      const deactivatedUser = { ...mockUser, status: false };
      prisma.user.update.mockResolvedValue(deactivatedUser);

      const result = await service.deactivate(mockUser.id);

      expect(result).toEqual((({ senha, ...rest }) => rest)(deactivatedUser));
    });

    it('deve lançar NotFoundException se o usuário não for encontrado', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.deactivate('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deve lançar ConflictException se o usuário já estiver inativo', async () => {
      const inactiveUser = { ...mockUser, status: false };
      prisma.user.findUnique.mockResolvedValue(inactiveUser);

      await expect(service.deactivate(mockUser.id)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('activateUser', () => {
    it('deve ativar um usuário com sucesso (verificação de email)', async () => {
      const unverifiedUser = { ...mockUser, emailVerificado: null };
      const activatedUser = { ...mockUser, emailVerificado: new Date() };
      prisma.user.findUnique.mockResolvedValue(unverifiedUser);
      prisma.user.update.mockResolvedValue(activatedUser);

      const result = await service.activateUser(mockUser.id);

      expect(result).toEqual((({ senha, ...rest }) => rest)(activatedUser));
    });

    it('deve lançar NotFoundException se o usuário não for encontrado', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.activateUser('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
