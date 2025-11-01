import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CreateExchangeCredentialDto } from './dto/create-exchange-credential.dto';
import { WalletService } from './wallet.service';
// importe seu AuthGuard JWT do projeto
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}
  private readonly logger = new Logger(WalletController.name);

  @Post('credentials')
  saveCredentials(@Req() req, @Body() dto: CreateExchangeCredentialDto) {
    this.logger.log('Salvando credenciais para user ' + req.user.userId);
    const userId = req.user.userId;
    return this.walletService.upsertCredentials(userId, dto);
  }

  @Get('credentials')
  async getCredentials(@Req() req) {
    const userId = req.user.userId;
    return this.walletService.getCredential(userId);
  }

  @Get('binance/balances')
  async getUserBalances(@Req() req) {
    const userId = req.user.userId;
    return this.walletService.fetchUserBalances(userId);
  }
}
