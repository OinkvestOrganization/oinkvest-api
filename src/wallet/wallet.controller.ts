import { Controller, Post, Body, Get, Req, UseGuards } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { CreateExchangeCredentialDto } from './dto/create-exchange-credential.dto';
// importe seu AuthGuard JWT do projeto
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post('credentials')
  saveCredentials(@Req() req, @Body() dto: CreateExchangeCredentialDto) {
    const userId = req.user.id;
    return this.walletService.upsertCredentials(userId, dto);
  }

  @Get('credentials')
  async getCredentials(@Req() req) {
    const userId = req.user.id;
    return this.walletService.getCredential(userId);
  }
}
