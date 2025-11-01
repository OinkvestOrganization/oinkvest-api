import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoUtil } from '../common/utils/crypto.util';
import { CreateExchangeCredentialDto } from './dto/create-exchange-credential.dto';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

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
}
