import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
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

  @Post('sync/balances')
  async syncBalances(@Req() req) {
    const userId = req.user.userId || req.user.id || req.user.sub;
    return this.walletService.syncSpotBalances(userId);
  }

  @Get('balances')
  async listBalances(
    @Req() req,
    @Query('asset') asset?: string,
    @Query('minTotal') minTotal?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    const userId = req.user.userId || req.user.id || req.user.sub;
    return this.walletService.listBalances(userId, {
      asset,
      minTotal: minTotal ? Number(minTotal) : undefined,
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
    });
  }
}
