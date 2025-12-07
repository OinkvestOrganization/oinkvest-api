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

/**
 * 📊 TRADE SERVICE - Sincronização de Histórico de Trades
 *
 * Este serviço gerencia todo o ciclo de sincronização de trades históricas da Binance.
 *
 * MÉTODOS PRINCIPAIS:
 * 🎯 syncTradesForSymbol() - Sincroniza trades de UM símbolo específico
 * 🎯 syncTradesForMultipleSymbols() - Sincroniza trades de VÁRIOS símbolos específicos
 * 🎯 syncAllTradesForWallet() ⭐ RECOMENDADO - Sincroniza trades APENAS dos ativos em carteira
 * 🎯 syncAllTradesForWalletAllSymbols() - Sincroniza trades de TODOS os símbolos USDT (não recomendado, lento)
 * 🎯 getWalletAssetSymbols() - Obtém símbolos com saldo > 0 do banco de dados
 * 🎯 discoverUserSymbols() - Descobre TODOS os símbolos USDT da exchange
 *
 * IMPORTANTE:
 * - getWalletAssetSymbols() consulta o BANCO DE DADOS (dados já sincronizados)
 * - discoverUserSymbols() consulta a EXCHANGE em TEMPO REAL (todos os pares)
 * - Use syncAllTradesForWallet() para sincronizar APENAS ativos da carteira (recomendado)
 * - Use syncAllTradesForWalletAllSymbols() apenas se precisar de todos os símbolos USDT
 */
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

        // Se recebeu menos de 1000 trades, não há mais dados
        if (trades.length < 1000) {
          hasMore = false;
        }
      } catch (error) {
        throw error;
      }
    }

    // Conta o total de trades no banco para este símbolo
    const totalInDatabase = await this.prisma.trade.count({
      where: { userId, symbol },
    });

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
   * Obtém os símbolos da carteira com saldo Spot > 0
   * Consulta apenas os ativos que foram sincronizados pelo endpoint wallet/sync/balances
   * com saldo diferente de zero
   */
  async getWalletAssetSymbols(userId: string): Promise<string[]> {
    try {
      // Buscar todos os ativos com saldo > 0 na WalletBalance
      const balances = await this.prisma.walletBalance.findMany({
        where: {
          userId,
          total: { gt: new Decimal(0) }, // Apenas ativos com saldo > 0
        },
        select: { asset: true },
        orderBy: { asset: 'asc' },
      });

      if (balances.length === 0) {
        return [];
      }

      // Converter assets em símbolos USDT (ex: BTC -> BTCUSDT, ETH -> ETHUSDT)
      const symbols = balances.map((b) => `${b.asset}USDT`);

      return symbols;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Descobre todos os símbolos únicos que o usuário já negociou
   * Busca na Binance usando a API de exchange info
   * NOTA: Este método sincroniza TODOS os símbolos USDT da Binance, não apenas os da carteira
   */
  async discoverUserSymbols(userId: string): Promise<string[]> {
    const cred = await this.prisma.exchangeCredential.findUnique({
      where: { userId_exchange: { userId, exchange: 'BINANCE' } },
    });

    if (!cred) {
      throw new NotFoundException('Credenciais da Binance não encontradas');
    }

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

      return usdtSymbols;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Sincroniza TODAS as trades históricas de uma carteira
   * Sincroniza APENAS os ativos que possuem saldo em carteira (Spot)
   * Os ativos devem ter sido sincronizados primeiro com /wallet/sync/balances
   */
  async syncAllTradesForWallet(
    userId: string,
    options?: { skipSymbols?: string[] },
  ) {
    const skipSymbols = new Set(options?.skipSymbols || []);

    // Obter apenas os símbolos da carteira com saldo > 0
    let symbolsWithBalance: string[];
    try {
      symbolsWithBalance = await this.getWalletAssetSymbols(userId);
    } catch (error) {
      throw error;
    }

    if (symbolsWithBalance.length === 0) {
      return {
        status: 'no_assets',
        totalSymbols: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        totalTradesSynced: 0,
        totalTradesInDatabase: 0,
        symbols: [],
        message:
          'Nenhum ativo com saldo encontrado. Por favor, execute /wallet/sync/balances primeiro para sincronizar sua carteira.',
      };
    }

    // Sincronizar apenas os símbolos da carteira (filtrando os skip)
    const symbolsToSync = symbolsWithBalance.filter((s) => !skipSymbols.has(s));

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
      message: `Sincronização de carteira finalizada. ${successfulSyncs.length}/${symbolsToSync.length} símbolos sincronizados com sucesso.`,
    };
  }

  /**
   * Sincroniza TODAS as trades de TODOS os símbolos USDT da exchange
   * AVISO: Isto sincroniza literalmente TODOS os pares USDT disponíveis, o que pode levar muito tempo
   * Use syncAllTradesForWallet() para sincronizar apenas os ativos em sua carteira (recomendado)
   */
  async syncAllTradesForWalletAllSymbols(
    userId: string,
    options?: { skipSymbols?: string[] },
  ) {
    const skipSymbols = new Set(options?.skipSymbols || []);

    // Descobrir TODOS os símbolos USDT da exchange (AVISO: pode ser muitos!)
    let allSymbols: string[];
    try {
      allSymbols = await this.discoverUserSymbols(userId);
    } catch (error) {
      throw error;
    }

    // Sincronizar TODOS os símbolos encontrados (sem limite)
    const symbolsToSync = allSymbols.filter((s) => !skipSymbols.has(s));

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
      message: `Sincronização completa de TODOS os símbolos finalizada. ${successfulSyncs.length}/${symbolsToSync.length} símbolos sincronizados com sucesso.`,
    };
  }

  /**
   * 📊 Calcula o preço médio de uma posição processando as trades em ordem cronológica
   *
   * LÓGICA:
   * Mantém dois valores enquanto processa cada trade sequencialmente:
   * - qty:  quantidade líquida do ativo base (ex: BTC em BTCUSDT)
   * - cost: quanto de USDT ainda está "preso" na posição
   * - averagePrice = cost / qty (preço médio)
   *
   * TRATAMENTO POR TIPO DE TRADE:
   *
   * 1) COMPRA COM TAXA NO ATIVO BASE (ex: taxa em BTC)
   *    - Você compra Q unidades de BTC
   *    - Paga V em USDT
   *    - Perde feeBase BTC para taxa
   *    - Resultado: qty += Q - feeBase, cost += V
   *    - Efeito: preço médio sobe (menos BTC, mesmo USDT gasto)
   *
   * 2) VENDA COM TAXA NO ATIVO COTADO (ex: taxa em USDT)
   *    - Você vende Q unidades de BTC
   *    - Recebe V em USDT
   *    - Paga feeQuote em USDT
   *    - Resultado: qty -= Q, cost -= (V - feeQuote)
   *    - Efeito: preço médio da posição restante cai (realizou ganho/perda)
   *
   * 3) POSIÇÃO ZERADA
   *    - Se qty ficar < 1e-12 (praticamente 0), zera tudo
   *    - Significa que vendeu tudo, lucro/prejuízo realizado
   *
   * EXEMPLO PRÁTICO (BTCUSDT):
   * - Passo 1: Compra 1 BTC a 100k, taxa 0.001 BTC
   *   qty=0.999, cost=100000, avgPrice=100100.10
   * - Passo 2: Vende 0.4 BTC a 120k, taxa 10 USDT
   *   qty=0.599, cost=52010, avgPrice=86861
   *   (break-even: vender a 86861 fecha zerado)
   */
  async calculateAveragePrice(
    userId: string,
    symbol: string,
  ): Promise<{
    quantity: Decimal;
    cost: Decimal;
    averagePrice: Decimal;
  }> {
    const trades = await this.prisma.trade.findMany({
      where: { userId, symbol },
      orderBy: { executedTime: 'asc' },
      select: {
        quantity: true,
        quoteQuantity: true,
        commission: true,
        commissionAsset: true,
        isBuyer: true,
        executedTime: true,
      },
    });

    if (trades.length === 0) {
      return {
        quantity: new Decimal(0),
        cost: new Decimal(0),
        averagePrice: new Decimal(0),
      };
    }

    // Ex.: BTCUSDT -> base = BTC, quote = USDT
    const base = symbol.replace('USDT', '');
    const quote = 'USDT';

    const ZERO = new Decimal(0);
    const EPS = new Decimal('0.00001'); // tolerância para "poeira" de qty

    let qty = ZERO; // quantidade atual em ativo base (BTC)
    let cost = ZERO; // custo contábil da posição (sempre ≈ qty * avgPrice)
    let realizedPnl = ZERO; // opcional, só para controle interno

    for (const trade of trades) {
      const q = new Decimal(trade.quantity.toString()); // base
      const v = new Decimal(trade.quoteQuantity.toString()); // quote
      const commission = new Decimal(trade.commission.toString());

      const feeBase = trade.commissionAsset === base ? commission : ZERO;
      const feeQuote = trade.commissionAsset === quote ? commission : ZERO;

      if (trade.isBuyer) {
        // COMPRA – taxa no ativo base (BTC) na maioria dos casos
        const netQty = q.minus(feeBase); // entra menos BTC por causa da taxa
        const tradeCost = v.plus(feeQuote); // se algum dia vier taxa em USDT também

        qty = qty.plus(netQty);
        cost = cost.plus(tradeCost);
      } else {
        // VENDA – taxa no ativo cotado (USDT)
        const netQty = q; // quantidade de BTC vendida
        const proceeds = v.minus(feeQuote); // USDT líquido que entrou

        if (qty.gt(ZERO)) {
          const avgBefore = cost.div(qty); // preço médio antes da venda
          const costOfSold = avgBefore.mul(netQty); // custo contábil dos BTC vendidos

          // lucro/prejuízo realizado nessa venda (opcional)
          realizedPnl = realizedPnl.plus(proceeds.minus(costOfSold));

          // tira do COST apenas o custo da quantidade vendida
          cost = cost.minus(costOfSold);
        }

        // diminui posição em BTC
        qty = qty.minus(netQty);
      }

      // Se sobrou só poeira, considera que zerou a posição
      if (qty.abs().lt(EPS)) {
        qty = ZERO;
        cost = ZERO;
      }
    }

    const averagePrice = qty.abs().gte(EPS) ? cost.div(qty) : ZERO;

    return {
      quantity: qty,
      cost,
      averagePrice,
    };
  }

  /**
   * Retorna comissão agrupada por ativo
   * Essencial para entender em qual ativo a comissão foi cobrada
   */
  async getCommissionBreakdown(userId: string) {
    const commissionByAsset = await this.prisma.trade.groupBy({
      by: ['commissionAsset'],
      where: { userId },
      _sum: { commission: true },
      _count: { id: true },
    });

    return commissionByAsset.map((c) => ({
      asset: c.commissionAsset,
      amount: c._sum.commission?.toString() || '0',
      tradeCount: c._count.id,
    }));
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
          _sum: { quantity: true, quoteQuantity: true, commission: true },
        });

        const sellAggregate = await this.prisma.trade.aggregate({
          where: { userId, symbol, isBuyer: false },
          _sum: { quantity: true, quoteQuantity: true, commission: true },
        });

        // Calcular saldo
        const totalBuyQuantity = buyAggregate._sum.quantity
          ? new Decimal(buyAggregate._sum.quantity)
          : new Decimal(0);
        const totalSellQuantity = sellAggregate._sum.quantity
          ? new Decimal(sellAggregate._sum.quantity)
          : new Decimal(0);

        const balance = totalBuyQuantity.minus(totalSellQuantity);

        // Comissão por tipo de trade
        const buyCommission = buyAggregate._sum.commission
          ? new Decimal(buyAggregate._sum.commission)
          : new Decimal(0);
        const sellCommission = sellAggregate._sum.commission
          ? new Decimal(sellAggregate._sum.commission)
          : new Decimal(0);

        // Saldo livre = balance - buyCommission (apenas comissão de compra reduz o saldo)
        const free = balance.minus(buyCommission);

        // Calcular preço médio processando trades em ordem
        const avgPriceData = await this.calculateAveragePrice(userId, symbol);

        return {
          symbol,
          tradeCount: stat._count.id,
          buyCount: buyTradesCount,
          sellCount: sellTradesCount,
          totalBuyQuantity: totalBuyQuantity.toString(),
          totalSellQuantity: totalSellQuantity.toString(),
          balance: balance.toString(),
          free: free.toString(),
          totalBuyValue: buyAggregate._sum.quoteQuantity?.toString() || '0',
          totalSellValue: sellAggregate._sum.quoteQuantity?.toString() || '0',
          buyCommission: buyCommission.toString(),
          sellCommission: sellCommission.toString(),
          totalCommission: stat._sum.commission?.toString() || '0',
          // Novos campos: preço médio da posição
          currentQuantity: avgPriceData.quantity.toString(),
          investedCost: avgPriceData.cost.toString(),
          averagePrice: avgPriceData.averagePrice.toString(),
        };
      }),
    );

    return {
      totalTrades,
      totalSymbols: stats.length,
      totalBuys: buyTrades,
      totalSells: sellTrades,
      totalCommissionPaid: totalCommission._sum.commission?.toString() || '0',
      commissionBreakdown: await this.getCommissionBreakdown(userId),
      firstTradeDate: tradeDates.length > 0 ? tradeDates[0].executedTime : null,
      lastTradeDate:
        tradeDates.length > 0
          ? tradeDates[tradeDates.length - 1].executedTime
          : null,
      symbols: symbolDetails,
    };
  }
}
