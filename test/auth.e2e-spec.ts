import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { EmailService } from '../src/email/email.service';

describe('Auth E2E (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  const mockEmailService = {
    sendVerificationEmail: jest.fn().mockResolvedValue(true),
  };

  const mockUser = {
    email: 'e2e-test@example.com',
    nome: 'E2E Test User',
    senha: 'Password@123',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailService)
      .useValue(mockEmailService)
      .compile();

    app = moduleFixture.createNestApplication();

    app.use(cookieParser());

    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );

    prismaService = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);
    await app.init();
    await app.listen(0);
  });

  beforeEach(async () => {
    // Limpar o Banco: Antes de tudo, limpe as tabelas User e VerificationToken do seu banco de dados de teste.
    await prismaService.user.deleteMany();
    await prismaService.verificationToken.deleteMany();

    mockEmailService.sendVerificationEmail.mockClear();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Registro, Verificação, Login e Acesso a Rota Protegida (Fluxo Completo)', async () => {
    let verificationToken: string;

    // 1. POST /auth/register: Use supertest para enviar uma requisição de registro.
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send(mockUser)
      .expect(201);

    expect(registerResponse.body.message).toBe(
      'Cadastro realizado com sucesso. Verifique seu e-mail para ativar sua conta.',
    );

    expect(mockEmailService.sendVerificationEmail).toHaveBeenCalledTimes(1);

    // 2. Verificar o Token:
    const tokenRecord = await prismaService.verificationToken.findFirst({
      where: { user: { email: mockUser.email } },
      include: { user: true },
    });

    expect(tokenRecord).toBeDefined();
    verificationToken = tokenRecord.token;
    const userId = tokenRecord.user.id;

    // 3. POST /auth/verify: Use supertest para chamar o endpoint de verificação com o token que você pegou do banco.
    await request(app.getHttpServer())
      .post('/auth/verify')
      .query({ token: verificationToken })
      .expect(201);

    // 4. POST /auth/login: Use supertest para fazer login com o usuário agora verificado.
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: mockUser.email, senha: mockUser.senha })
      .expect(200);

    expect(loginResponse.headers['set-cookie']).toBeDefined();
    const accessTokenCookie = loginResponse.headers['set-cookie'][0];

    // 5. Testar o OwnerGuard (O Teste de Fogo): A rota /user/:id usa o OwnerGuard
    // 5.1. Acesso com ID correto (200 OK)
    await request(app.getHttpServer())
      .get(`/user/${userId}`)
      .set('Cookie', accessTokenCookie)
      .expect(200);

    // 5.2. Acesso com ID diferente (403 FORBIDDEN)
    const fakeUserId = '00000000-0000-0000-0000-000000000000';
    await request(app.getHttpServer())
      .get(`/user/${fakeUserId}`)
      .set('Cookie', accessTokenCookie)
      .expect(403);
  });
});
