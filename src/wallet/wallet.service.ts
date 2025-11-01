import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { BinanceSpotClientService } from '../binance/binance-spot-client.service';
import { CryptoUtil } from '../common/utils/crypto.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExchangeCredentialDto } from './dto/create-exchange-credential.dto';

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly binanceClient: BinanceSpotClientService,
  ) {}

  upsertCredentials(userId: string, dto: CreateExchangeCredentialDto) {
    const encryptedKey = CryptoUtil.encrypt(dto.apiKey);
    const encryptedSecret = CryptoUtil.encrypt(dto.apiSecret);

    const cred = this.prisma.exchangeCredential.upsert({
      where: { userId_exchange: { userId, exchange: 'BINANCE' } },
      create: {
        userId,
        exchange: 'BINANCE',
        apiKey: encryptedKey,
        apiSecret: encryptedSecret,
      },
      update: {
        apiKey: encryptedKey,
        apiSecret: encryptedSecret,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        userId: true,
        exchange: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return cred;
  }

  async getCredential(userId: string) {
    const cred = await this.prisma.exchangeCredential.findUnique({
      where: { userId_exchange: { userId, exchange: 'BINANCE' } },
    });
    if (!cred) throw new NotFoundException('No Binance credentials found');
    return {
      id: cred.id,
      exchange: cred.exchange,
      status: cred.status,
      createdAt: cred.createdAt,
      updatedAt: cred.updatedAt,
    };
  }

  async fetchUserBalances(userId: string) {
    const cred = await this.prisma.exchangeCredential.findUnique({
      where: { userId_exchange: { userId, exchange: 'BINANCE' } },
    });
    if (!cred) throw new Error('Credenciais da Binance não encontradas');

    const apiKey = CryptoUtil.decrypt(cred.apiKey);
    const apiSecret = CryptoUtil.decrypt(cred.apiSecret);

    const account = await this.binanceClient.getAccountInfo(apiKey, apiSecret);
    const balances = account.balances.filter(
      (b) => parseFloat(b.free) + parseFloat(b.locked) > 0,
    );

    Logger.log(`Saldos obtidos: ${balances.length} ativos para user ${userId}`);
    return balances;
  }
}
