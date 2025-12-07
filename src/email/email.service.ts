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

  async sendPasswordResetEmail(to: string, token: string) {
    const resetUrl = `${process.env.APP_URL ?? 'http://localhost:3000'}/reset-password?token=${encodeURIComponent(token)}`;
    const subject = 'Redefinição de senha';
    const html = `
    <div style="width:100%;background:#f4f4f5; margin:auto">
      <div style="max-width:600px;margin:0 auto;background:#fff;padding:50px;border-radius:8px;font-family:Arial,sans-serif;line-height:1.5;color:#333;text-align:center">
        <h1 style="color:#EAB308;font-size:40px;margin:0 0 12px 0;">OINKVEST</h1>
        <h2 style="color:#000;font-size:28px;margin:0 0 20px 0;">Pedido de redefinição de senha</h2>
        <p style="margin:0 0 20px 0;font-size:16px;color:#555;">
          Para prosseguir com o processo de redifinição de senha, clique no botão abaixo.
        </p>

        <a href="${resetUrl}" 
            style="display:inline-block;background:#7C3AED;color:#fff;padding:14px 24px;
                    border-radius:8px;text-decoration:none;font-size:14px;font-weight:bold;width:auto">
            REDEFINIR MINHA SENHA
        </a>
        <p style="margin:24px 0 8px 0;font-size:16px;color:#555;">Ou cole este link no seu navegador</p>
        <a href="${resetUrl}" style="color:#2563eb;font-size:14px;text-decoration:none;">
          ${resetUrl}
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

async sendSupportTicket(userEmail: string, userName: string, subject: string, message: string) {
    const adminEmail = process.env.EMAIL_FROM;
    const dataHora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5; }
        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background-color: #18181b; padding: 30px; text-align: center; border-bottom: 4px solid #fbbf24; }
        .logo { color: #fbbf24; font-size: 28px; font-weight: bold; margin: 0; letter-spacing: 1px; text-transform: uppercase; }
        .content { padding: 40px 30px; color: #333333; }
        .badge { display: inline-block; background-color: #f3f4f6; color: #6b7280; padding: 4px 12px; border-radius: 99px; font-size: 12px; font-weight: 600; margin-bottom: 20px; }
        .info-grid { display: table; width: 100%; margin-bottom: 30px; border-collapse: collapse; }
        .info-row { display: table-row; }
        .info-label { display: table-cell; font-size: 13px; color: #888; padding-bottom: 5px; width: 100px; font-weight: 600; }
        .info-value { display: table-cell; font-size: 15px; color: #111; padding-bottom: 15px; font-weight: 500; }
        .message-box { background-color: #fffbeb; border-left: 4px solid #fbbf24; padding: 20px; border-radius: 4px; margin-top: 10px; }
        .message-label { font-size: 12px; color: #92400e; font-weight: bold; text-transform: uppercase; margin-bottom: 8px; display: block; }
        .message-text { font-size: 16px; line-height: 1.6; color: #333; white-space: pre-wrap; margin: 0; }
        .footer { background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo">OINKVEST</h1>
        </div>

        <div class="content">
          <div style="text-align: center;">
            <span class="badge">NOVO TICKET DE SUPORTE</span>
          </div>

          <h2 style="margin-top: 0; color: #111; font-size: 22px; text-align: center; margin-bottom: 30px;">
            ${subject}
          </h2>

          <div class="info-grid">
            <div class="info-row">
              <span class="info-label">USUÁRIO:</span>
              <span class="info-value">${userName}</span>
            </div>
            <div class="info-row">
              <span class="info-label">E-MAIL:</span>
              <span class="info-value"><a href="mailto:${userEmail}" style="color: #2563eb; text-decoration: none;">${userEmail}</a></span>
            </div>
            <div class="info-row">
              <span class="info-label">DATA:</span>
              <span class="info-value">${dataHora}</span>
            </div>
          </div>

          <div class="message-box">
            <span class="message-label">Mensagem do Usuário:</span>
            <p class="message-text">${message}</p>
          </div>
        </div>

        <div class="footer">
          <p>Este e-mail foi enviado automaticamente através do painel de suporte da Oinkvest.</p>
          <p>Para responder ao usuário, basta clicar em "Responder" no seu cliente de e-mail.</p>
        </div>
      </div>
    </body>
    </html>
    `;

    return await this.mailer.sendMail({
      to: adminEmail,
      replyTo: userEmail,
      subject: `[Suporte] ${subject} - ${userName}`,
      html,
    });
  }
}
