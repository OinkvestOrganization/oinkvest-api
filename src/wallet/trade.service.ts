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

  /**
   * Descobre todos os símbolos únicos que o usuário já negociou
   * Busca na Binance usando a API de exchange info
   */
  async discoverUserSymbols(userId: string): Promise<string[]> {
    const cred = await this.prisma.exchangeCredential.findUnique({
      where: { userId_exchange: { userId, exchange: 'BINANCE' } },
    });

    if (!cred) {
      throw new NotFoundException('Credenciais da Binance não encontradas');
    }

    this.logger.log(`Descobrindo símbolos para o usuário ${userId}`);

    try {
      // Usar HttpService diretamente para chamadas públicas
      const response = await fetch(
        'https://api.binance.com/api/v3/exchangeInfo',
      );
      if (!response.ok) {
        throw new Error(`Falha ao obter exchange info: ${response.status}`);
      }

      const exchangeInfo = await response.json();

      if (!exchangeInfo || !exchangeInfo.symbols) {
        this.logger.error('Não foi possível obter exchange info');
        throw new Error('Falha ao obter informações da exchange');
      }

      // Obter TODOS os símbolos USDT disponíveis para Spot Trading
      const usdtSymbols = exchangeInfo.symbols
        .filter(
          (s: any) =>
            s.status === 'TRADING' &&
            s.baseAsset &&
            s.quoteAsset === 'USDT' &&
            !s.baseAsset.startsWith('LD') &&
            !s.baseAsset.startsWith('ST'), // Exclude staking tokens
        )
        .map((s: any) => s.symbol);

      this.logger.log(
        `Descobertos ${usdtSymbols.length} símbolos USDT disponíveis para sincronizar`,
      );

      return usdtSymbols;
    } catch (error) {
      this.logger.error(`Erro ao descobrir símbolos: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sincroniza TODAS as trades históricas de uma carteira
   * Descobre automaticamente e sincroniza TODOS os símbolos USDT disponíveis
   */
  async syncAllTradesForWallet(
    userId: string,
    options?: { skipSymbols?: string[] },
  ) {
    this.logger.log(
      `Iniciando sincronização COMPLETA de histórico para usuário ${userId}`,
    );

    const skipSymbols = new Set(options?.skipSymbols || []);

    let allSymbols: string[];
    try {
      allSymbols = await this.discoverUserSymbols(userId);
    } catch (error) {
      this.logger.error(
        `Falha ao descobrir símbolos para ${userId}: ${error.message}`,
      );
      throw error;
    }

    // Sincronizar TODOS os símbolos encontrados (sem limite)
    const symbolsToSync = allSymbols.filter((s) => !skipSymbols.has(s));

    this.logger.log(
      `Sincronizando ${symbolsToSync.length} símbolos para ${userId}`,
    );

    const results = await this.syncTradesForMultipleSymbols(
      userId,
      symbolsToSync,
    );

    // Compilar estatísticas
    const successfulSyncs = results.filter((r) => !r.error);
    const failedSyncs = results.filter((r) => r.error);

    const totalSynced = successfulSyncs.reduce((sum, r) => sum + r.synced, 0);
    const totalInDatabase = successfulSyncs.reduce(
      (sum, r) => sum + r.totalInDatabase,
      0,
    );

    return {
      status: 'completed',
      totalSymbols: symbolsToSync.length,
      successfulSyncs: successfulSyncs.length,
      failedSyncs: failedSyncs.length,
      totalTradesSynced: totalSynced,
      totalTradesInDatabase: totalInDatabase,
      symbols: results,
      message: `Sincronização completa finalizada. ${successfulSyncs.length}/${symbolsToSync.length} símbolos sincronizados com sucesso.`,
    };
  }

  /**
   * Retorna resume do histórico completo de trades da carteira
   * Inclui detalhes por símbolo: buys, sells, saldo, valores
   */
  async getWalletTradesSummary(userId: string) {
    const stats = await this.prisma.trade.groupBy({
      by: ['symbol'],
      where: { userId },
      _count: { id: true },
      _sum: { commission: true },
      orderBy: { _count: { id: 'desc' } },
    });

    const totalTrades = await this.prisma.trade.count({ where: { userId } });

    const tradeDates = await this.prisma.trade.findMany({
      where: { userId },
      select: { executedTime: true },
      orderBy: { executedTime: 'asc' },
      take: 2,
    });

    const buyTrades = await this.prisma.trade.count({
      where: { userId, isBuyer: true },
    });

    const sellTrades = await this.prisma.trade.count({
      where: { userId, isBuyer: false },
    });

    const totalCommission = await this.prisma.trade.aggregate({
      where: { userId },
      _sum: { commission: true },
    });

    // Obter detalhes por símbolo
    const symbolDetails = await Promise.all(
      stats.map(async (stat) => {
        const symbol = stat.symbol;

        // Total de compras e vendas por símbolo
        const buyTradesCount = await this.prisma.trade.count({
          where: { userId, symbol, isBuyer: true },
        });

        const sellTradesCount = await this.prisma.trade.count({
          where: { userId, symbol, isBuyer: false },
        });

        // Agregações por tipo de trade
        const buyAggregate = await this.prisma.trade.aggregate({
          where: { userId, symbol, isBuyer: true },
          _sum: { quantity: true, quoteQuantity: true },
        });

        const sellAggregate = await this.prisma.trade.aggregate({
          where: { userId, symbol, isBuyer: false },
          _sum: { quantity: true, quoteQuantity: true },
        });

        // Calcular saldo
        const totalBuyQuantity = buyAggregate._sum.quantity
          ? new Decimal(buyAggregate._sum.quantity)
          : new Decimal(0);
        const totalSellQuantity = sellAggregate._sum.quantity
          ? new Decimal(sellAggregate._sum.quantity)
          : new Decimal(0);

        const balance = totalBuyQuantity.minus(totalSellQuantity);

        return {
          symbol,
          tradeCount: stat._count.id,
          buyCount: buyTradesCount,
          sellCount: sellTradesCount,
          totalBuyQuantity: totalBuyQuantity.toString(),
          totalSellQuantity: totalSellQuantity.toString(),
          balance: balance.toString(),
          totalBuyValue: buyAggregate._sum.quoteQuantity?.toString() || '0',
          totalSellValue: sellAggregate._sum.quoteQuantity?.toString() || '0',
          totalCommission: stat._sum.commission?.toString() || '0',
        };
      }),
    );

    return {
      totalTrades,
      totalSymbols: stats.length,
      totalBuys: buyTrades,
      totalSells: sellTrades,
      totalCommissionPaid: totalCommission._sum.commission?.toString() || '0',
      firstTradeDate: tradeDates.length > 0 ? tradeDates[0].executedTime : null,
      lastTradeDate:
        tradeDates.length > 0
          ? tradeDates[tradeDates.length - 1].executedTime
          : null,
      symbols: symbolDetails,
    };
  }
}
