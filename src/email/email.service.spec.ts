import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import { MailerService } from '@nestjs-modules/mailer';

// Mock do MailerService
const mockMailerService = {
  sendMail: jest.fn(),
};

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: MailerService,
          useValue: mockMailerService,
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    service = module.get<EmailService>(EmailService);
    jest.clearAllMocks();
    // Define uma variável de ambiente para simular o APP_URL
    process.env.APP_URL = 'https://app.oinkvest.com';
  });

  afterEach(() => {
    delete process.env.APP_URL;
  });

  it('deve ser definido', () => {
    expect(service).toBeDefined();
  });

  describe('sendVerificationEmail', () => {
    const to = 'user@example.com';
    const token = 'a-secure-token-with-special-chars-!@#$';
    const nome = 'João';
    const encodedToken = encodeURIComponent(token);
    const expectedUrl = `https://app.oinkvest.com/verify?token=${encodedToken}`;

    it('deve chamar mailer.sendMail com os parâmetros corretos', async () => {
      await service.sendVerificationEmail(to, token, nome);

      expect(mockMailerService.sendMail).toHaveBeenCalledTimes(1);
      const call = mockMailerService.sendMail.mock.calls[0][0];

      expect(call.to).toBe(to);
      expect(call.subject).toBe('Confirme seu e-mail');
      expect(call.html).toContain(nome);
      expect(call.html).toContain(expectedUrl);
    });

    it('deve usar o fallback localhost se APP_URL não estiver definido', async () => {
      delete process.env.APP_URL;
      const fallbackUrl = `http://localhost:3000/verify?token=${encodedToken}`;

      await service.sendVerificationEmail(to, token, nome);

      const call = mockMailerService.sendMail.mock.calls[0][0];
      expect(call.html).toContain(fallbackUrl);
    });

    it('deve lidar com token que precisa de encoding', async () => {
      await service.sendVerificationEmail(to, token, nome);

      const call = mockMailerService.sendMail.mock.calls[0][0];
      // Verifica se o token foi corretamente codificado na URL
      expect(call.html).toContain(expectedUrl);
      expect(call.html).not.toContain(token);
    });
  });
});
