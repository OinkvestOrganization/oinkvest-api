import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class EmailService {
  constructor(private readonly mailer: MailerService) {}
  async sendVerificationEmail(to: string, token: string, nome?: string) {
    const verifyUrl = `${process.env.APP_URL ?? 'http://localhost:3001'}/auth/verify?token=${encodeURIComponent(token)}`;

    const subject = 'Confirme seu e-mail';
    const html = `
      <div style="font-family: Arial, sans-serif; line-height:1.4">
        <h2>Olá${nome ? `, ${nome}` : ''}!</h2>
        <p>Obrigado por se cadastrar. Para ativar sua conta, confirme seu e-mail clicando no botão abaixo:</p>
        <p>
          <a href="${verifyUrl}"
             style="display:inline-block;padding:10px 16px;text-decoration:none;border-radius:8px;border:1px solid #222">
            Confirmar e-mail
          </a>
        </p>
        <p>Ou copie e cole este link no navegador:</p>
        <p><a href="${verifyUrl}">${verifyUrl}</a></p>
        <hr/>
        <small>Se você não solicitou este cadastro, ignore este e-mail.</small>
      </div>
    `;
    
    return await this.mailer.sendMail({
      to,
      subject,
      html,
    });
  }
}
