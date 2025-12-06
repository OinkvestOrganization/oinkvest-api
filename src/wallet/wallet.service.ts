import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CryptoUtil } from '../common/utils/crypto.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExchangeCredentialDto } from './dto/create-exchange-credential.dto';
import { Decimal } from '@prisma/client/runtime/binary';
import { BinanceRestClientService } from '@/binance/binance-rest-client.service';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly binanceClient: BinanceRestClientService,
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

    const account = await this.binanceClient.signedGet<{
      balances: Array<{ asset: string; free: string; locked: string }>;
    }>('/api/v3/account', apiKey, apiSecret);
    const balances = account.balances.filter(
      (b) => parseFloat(b.free) + parseFloat(b.locked) > 0,
    );

    Logger.log(`Saldos obtidos: ${balances.length} ativos para user ${userId}`);
    return balances;
  }

  async syncSpotBalances(userId: string) {
    // 1) abre log PENDING
    const log = await this.prisma.walletSyncLog.create({
      data: {
        userId,
        type: 'SPOT_BALANCE',
        status: 'PENDING',
        startedAt: new Date(),
      },
    });

    try {
      // 2) credenciais
      const cred = await this.prisma.exchangeCredential.findUnique({
        where: { userId_exchange: { userId, exchange: 'BINANCE' } },
      });
      if (!cred)
        throw new NotFoundException('Credenciais da Binance não encontradas');

      const apiKey = CryptoUtil.decrypt(cred.apiKey);
      const apiSecret = CryptoUtil.decrypt(cred.apiSecret);

      // 3) chamada na Binance
      const account = await this.binanceClient.signedGet<{
        balances: Array<{ asset: string; free: string; locked: string }>;
      }>('/api/v3/account', apiKey, apiSecret);

      // 4) normaliza e filtra
      const items = (account?.balances ?? [])
        .map((b) => {
          const free = Number(b.free || '0');
          const locked = Number(b.locked || '0');
          const total = free + locked;
          return {
            asset: b.asset,
            free: new Decimal(free.toString()),
            locked: new Decimal(locked.toString()),
            total: new Decimal(total.toString()),
          };
        })
        .filter((x) => x.asset && x.total.gt(0)); // somente > 0

      // 5) upserts transacionais (um por ativo)
      await this.prisma.$transaction(
        items.map((row) =>
          this.prisma.walletBalance.upsert({
            where: { userId_asset: { userId, asset: row.asset } }, // requer @@unique([userId, asset])
            create: {
              userId,
              asset: row.asset,
              free: row.free,
              locked: row.locked,
              total: row.total,
              lastSyncAt: new Date(),
            },
            update: {
              free: row.free,
              locked: row.locked,
              total: row.total,
              lastSyncAt: new Date(),
            },
          }),
        ),
      );

      // 6) finaliza log com sucesso
      await this.prisma.walletSyncLog.update({
        where: { id: log.id },
        data: {
          status: 'SUCCESS',
          finishedAt: new Date(),
          message: `Atualizados ${items.length} ativos.`,
        },
      });

      this.logger.log(
        `Sync de saldos concluído: ${items.length} ativos para user ${userId}`,
      );
      return { updated: items.length };
    } catch (e: any) {
      const message = e?.message ?? 'Erro desconhecido';
      // 7) finaliza log com erro
      await this.prisma.walletSyncLog.update({
        where: { id: log.id },
        data: {
          status: 'ERROR',
          finishedAt: new Date(),
          message,
        },
      });
      this.logger.error(`Sync de saldos falhou para ${userId}: ${message}`);
      throw e;
    }
  }

  /**
   * Lista saldos persistidos (com filtros simples).
   */
  async listBalances(
    userId: string,
    params?: {
      asset?: string;
      minTotal?: number;
      take?: number;
      skip?: number;
    },
  ) {
    const { asset, minTotal, take = 100, skip = 0 } = params ?? {};
    const balances = await this.prisma.walletBalance.findMany({
      where: {
        userId,
        asset: asset ? asset.toUpperCase() : undefined,
        total:
          minTotal != null
            ? { gt: new Decimal(minTotal.toString()) }
            : undefined,
      },
      orderBy: [{ total: 'desc' }, { asset: 'asc' }],
      take,
      skip,
      select: {
        asset: true,
        free: true,
        locked: true,
        total: true,
        lastSyncAt: true,
      },
    });

    // Convert Decimal to string for JSON serialization
    return balances.map((balance) => ({
      asset: balance.asset,
      free: balance.free.toString(),
      locked: balance.locked.toString(),
      total: balance.total.toString(),
      lastSyncAt: balance.lastSyncAt,
    }));
  }
}
