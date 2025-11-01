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

  @Post('credentials')
  saveCredentials(@Req() req, @Body() dto: CreateExchangeCredentialDto) {
    Logger.log('Saving exchange credentials for user:', req.user);
    const userId = req.user.userId;
    return this.walletService.upsertCredentials(userId, dto);
  }

  @Get('credentials')
  async getCredentials(@Req() req) {
    const userId = req.user.userId;
    return this.walletService.getCredential(userId);
  }
}
