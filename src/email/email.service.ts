import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class EmailService {
  constructor(private readonly mailer: MailerService) {}
  async sendVerificationEmail(to: string, token: string, nome?: string) {
    const verifyUrl = `${process.env.APP_URL ?? 'http://localhost:3000'}/verify?token=${encodeURIComponent(token)}`;

    const subject = 'Confirme seu e-mail';
    const html = `
      <div style="width:100%;background:#f4f4f5; margin:auto">
        <div style="max-width:600px;margin:0 auto;background:#fff;padding:50px;border-radius:8px;font-family:Arial,sans-serif;line-height:1.5;color:#333;text-align:center">
          <h1 style="color:#EAB308;font-size:40px;margin:0 0 12px 0;">OINKVEST</h1>
          <h2 style="color:#000;font-size:28px;margin:0 0 20px 0;">Seja muito bem vindo ${nome}. Para prosseguir, verifique seu email</h2>
          
          <p style="margin:0 0 20px 0;font-size:16px;color:#555;">
            Confirme que deseja usar esse endereço de e-mail para sua conta Oinkvest. 
            Assim que terminar, você poderá começar a investir!
          </p>
          
          <a href="${verifyUrl}" 
            style="display:inline-block;background:#7C3AED;color:#fff;padding:14px 24px;
                    border-radius:8px;text-decoration:none;font-size:14px;font-weight:bold;width:auto">
            VERIFICAR MEU E-MAIL
          </a>
          
          <p style="margin:24px 0 8px 0;font-size:16px;color:#555;">Ou cole este link no seu navegador</p>
          <a href="${verifyUrl}" style="color:#2563eb;font-size:14px;text-decoration:none;">
            ${verifyUrl}
          </a>
        </div>
      </div>

    `;

    return await this.mailer.sendMail({
      to,
      subject,
      html,
    });
  }
}
