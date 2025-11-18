import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CryptoUtil } from '../common/utils/crypto.util';
import { PrismaService } from '../prisma/prisma.service';
import { BinanceRestClientService } from '../binance/binance-rest-client.service';
import { Decimal } from '@prisma/client/runtime/binary';
import { ListTradesQueryDto, TradeStatsDto } from './dto/trade.dto';

interface BinanceTrade {
  symbol: string;
  id: number;
  orderId: number;
  orderListId: number;
  price: string;
  qty: string;
  quoteQty: string;
  commission: string;
  commissionAsset: string;
  time: number;
  isBuyer: boolean;
  isMaker: boolean;
  isBestMatch: boolean;
}

@Injectable()
export class TradeService {
  private readonly logger = new Logger(TradeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly binanceClient: BinanceRestClientService,
  ) {}

  /**
   * Sincroniza todo o histórico de trades de um símbolo
   * Usa paginação com fromId para trazer todos os trades desde o início
   */
  async syncTradesForSymbol(userId: string, symbol: string) {
    const cred = await this.prisma.exchangeCredential.findUnique({
      where: { userId_exchange: { userId, exchange: 'BINANCE' } },
    });

    if (!cred) {
      throw new NotFoundException('Credenciais da Binance não encontradas');
    }

    const apiKey = CryptoUtil.decrypt(cred.apiKey);
    const apiSecret = CryptoUtil.decrypt(cred.apiSecret);

    let totalSynced = 0;
    let hasMore = true;
    let fromId: number | undefined = undefined;
    let lastTradeTime: Date | undefined = undefined;

    this.logger.log(
      `Iniciando sincronização de trades para ${symbol} do usuário ${userId}`,
    );

    while (hasMore) {
      try {
        const params: Record<string, any> = {
          symbol: symbol.toUpperCase(),
          limit: 1000, // máximo permitido pela Binance
        };

        if (fromId) {
          params.fromId = fromId;
        }

        const trades = await this.binanceClient.signedGet<BinanceTrade[]>(
          '/api/v3/myTrades',
          apiKey,
          apiSecret,
          params,
        );

        if (!trades || trades.length === 0) {
          hasMore = false;
          break;
        }

        // Processa as trades em lote
        const tradesToInsert = trades.map((trade) => ({
          userId,
          symbol: trade.symbol,
          tradeId: BigInt(trade.id),
          orderId: BigInt(trade.orderId),
          orderListId: BigInt(trade.orderListId),
          price: new Decimal(trade.price),
          quantity: new Decimal(trade.qty),
          quoteQuantity: new Decimal(trade.quoteQty),
          commission: new Decimal(trade.commission),
          commissionAsset: trade.commissionAsset,
          isBuyer: trade.isBuyer,
          isMaker: trade.isMaker,
          isBestMatch: trade.isBestMatch,
          executedTime: new Date(trade.time),
        }));

        // Upsert para não duplicar trades
        for (const trade of tradesToInsert) {
          await this.prisma.trade.upsert({
            where: {
              userId_symbol_tradeId: {
                userId,
                symbol: trade.symbol,
                tradeId: trade.tradeId,
              },
            },
            create: trade,
            update: {
              lastSyncAt: new Date(),
            },
          });
        }

        totalSynced += trades.length;
        lastTradeTime = new Date(trades[trades.length - 1].time);

        // Atualiza o fromId para a próxima paginação
        fromId = trades[trades.length - 1].id;

        this.logger.log(
          `Sincronizadas ${trades.length} trades. Total: ${totalSynced}`,
        );

        // Se recebeu menos de 1000 trades, não há mais dados
        if (trades.length < 1000) {
          hasMore = false;
        }
      } catch (error) {
        this.logger.error(
          `Erro ao sincronizar trades para ${symbol}: ${error.message}`,
        );
        throw error;
      }
    }

    // Conta o total de trades no banco para este símbolo
    const totalInDatabase = await this.prisma.trade.count({
      where: { userId, symbol },
    });

    this.logger.log(
      `Sincronização concluída para ${symbol}: ${totalSynced} novos, ${totalInDatabase} total`,
    );

    return {
      synced: totalSynced,
      totalInDatabase,
      symbol,
      hasMore: false,
      lastSyncedTradeTime: lastTradeTime,
    };
  }

  /**
   * Sincroniza trades para múltiplos símbolos
   */
  async syncTradesForMultipleSymbols(userId: string, symbols: string[]) {
    const results: any[] = [];

    for (const symbol of symbols) {
      try {
        const result = await this.syncTradesForSymbol(userId, symbol);
        results.push(result);
      } catch (error) {
        this.logger.error(`Erro ao sincronizar ${symbol}: ${error.message}`);
        results.push({
          symbol,
          synced: 0,
          totalInDatabase: 0,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Lista trades com filtros e paginação
   */
  async listTrades(userId: string, query: ListTradesQueryDto) {
    const {
      symbol,
      page = 1,
      limit = 50,
      startDate,
      endDate,
      type = 'ALL',
      sortOrder = 'DESC',
    } = query;

    // Validações
    if (limit > 500) {
      throw new Error('Limite máximo de 500 registros por página');
    }

    // Construir filtros
    const where: any = { userId, symbol };

    // Filtro de data
    if (startDate || endDate) {
      where.executedTime = {};
      if (startDate) {
        where.executedTime.gte = new Date(startDate);
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        where.executedTime.lte = endDateTime;
      }
    }

    // Filtro de tipo de operação
    if (type === 'BUY') {
      where.isBuyer = true;
    } else if (type === 'SELL') {
      where.isBuyer = false;
    }

    // Contar total
    const total = await this.prisma.trade.count({ where });

    // Calcular skip
    const skip = (page - 1) * limit;
    const pages = Math.ceil(total / limit);

    // Buscar dados
    const trades = await this.prisma.trade.findMany({
      where,
      orderBy: { executedTime: sortOrder === 'ASC' ? 'asc' : 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        symbol: true,
        tradeId: true,
        orderId: true,
        price: true,
        quantity: true,
        quoteQuantity: true,
        commission: true,
        commissionAsset: true,
        isBuyer: true,
        isMaker: true,
        isBestMatch: true,
        executedTime: true,
        lastSyncAt: true,
        createdAt: true,
      },
    });

    // Converter bigint para string
    const formattedTrades = trades.map((trade) => ({
      ...trade,
      tradeId: trade.tradeId.toString(),
      orderId: trade.orderId.toString(),
      price: trade.price.toString(),
      quantity: trade.quantity.toString(),
      quoteQuantity: trade.quoteQuantity.toString(),
      commission: trade.commission.toString(),
    }));

    return {
      data: formattedTrades,
      page,
      limit,
      total,
      pages,
      hasNextPage: page < pages,
      hasPrevPage: page > 1,
    };
  }

  /**
   * Retorna estatísticas de trades
   */
  async getTradeStats(userId: string, symbol: string): Promise<TradeStatsDto> {
    const trades = await this.prisma.trade.findMany({
      where: { userId, symbol },
      orderBy: { executedTime: 'asc' },
    });

    if (trades.length === 0) {
      throw new NotFoundException(
        `Nenhuma trade encontrada para ${symbol} deste usuário`,
      );
    }

    const buys = trades.filter((t) => t.isBuyer);
    const sells = trades.filter((t) => !t.isBuyer);
    const totalCommission = trades.reduce((sum, trade) => {
      const commissionValue = trade.commission || new Decimal(0);
      return sum.plus(commissionValue);
    }, new Decimal(0));

    return {
      symbol,
      totalTrades: trades.length,
      totalBuys: buys.length,
      totalSells: sells.length,
      totalCommission: totalCommission.toFixed(8),
      firstTradeDate: trades[0].executedTime,
      lastTradeDate: trades[trades.length - 1].executedTime,
    };
  }

  /**
   * Exclui todos os trades de um usuário (para limpeza/reset)
   */
  async deleteAllTrades(userId: string) {
    const result = await this.prisma.trade.deleteMany({
      where: { userId },
    });

    this.logger.log(`${result.count} trades deletadas para usuário ${userId}`);

    return { deleted: result.count };
  }

  /**
   * Retorna a última trade sincronizada para um símbolo
   */
  async getLastSyncedTrade(userId: string, symbol: string) {
    return this.prisma.trade.findFirst({
      where: { userId, symbol },
      orderBy: { executedTime: 'desc' },
    });
  }
}
