import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  HttpStatus,
  Res,
} from '@nestjs/common';
import express from 'express';
import { JwtAuthGuard } from '@/auth/guard/jwt-auth.guard';
import { AuthRequest } from '@/auth/dto/AuthRequest';
import { EmailService } from '@/email/email.service';
import { CreateSupportDto } from './dto/create-support.dto';

@Controller('support')
export class SupportController {
  constructor(private readonly emailService: EmailService) {}

  @UseGuards(JwtAuthGuard)
  @Post('email')
  async sendSupportEmail(
    @Req() req: AuthRequest,
    @Body() data: CreateSupportDto,
    @Res() res: express.Response,
  ) {
    await this.emailService.sendSupportTicket(
      req.user.email,
      req.user.nome,
      data.subject,
      data.message,
    );

    return res
      .status(HttpStatus.OK)
      .json({ message: 'E-mail enviado com sucesso.' });
  }
}
