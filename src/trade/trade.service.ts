import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { BinanceRestClientService } from '@/binance/binance-rest-client.service';
import { CryptoUtil } from '@/common/utils/crypto.util';
import { WalletService } from '@/wallet/wallet.service';
import {
  PlaceOrderDto,
  PlaceOrderResponseDto,
  ListOrdersQueryDto,
  ListOrdersResponseDto,
} from './dto';
import { BinanceErrorHandler } from './utils/binance-error-handler';

@Injectable()
export class TradeService {
  private readonly logger = new Logger(TradeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly binanceClient: BinanceRestClientService,
    private readonly walletService: WalletService,
  ) {}

  /**
   * Valida saldo disponível para MARKET BUY
   */
  private async validateBalance(
    userId: string,
    side: string,
    symbol: string,
    quoteOrderQty?: string,
  ): Promise<string | null> {
    if (side !== 'BUY' || !quoteOrderQty) return null;

    const usdt = await this.prisma.walletBalance.findUnique({
      where: { userId_asset: { userId, asset: 'USDT' } },
    });

    if (!usdt) {
      return 'Nenhum saldo USDT disponível';
    }

    const required = parseFloat(quoteOrderQty);
    const available = parseFloat(usdt.free.toString());

    if (available < required) {
      return `Saldo USDT insuficiente. Disponível: ${available}, Necessário: ${required}`;
    }

    return null;
  }

  /**
   * Coloca uma nova ordem MARKET de compra ou venda
   */
  async placeMarketOrder(
    userId: string,
    dto: PlaceOrderDto,
  ): Promise<PlaceOrderResponseDto> {
    // 1️⃣ Validação: Usuário tem credenciais?
    const credentials = await this.prisma.exchangeCredential.findUnique({
      where: { userId_exchange: { userId, exchange: 'BINANCE' } },
    });

    if (!credentials) {
      throw new NotFoundException(
        'Credenciais Binance não encontradas. Por favor, salve suas chaves API primeiro.',
      );
    }

    if (credentials.status !== 'ACTIVE') {
      throw new BadRequestException('Credenciais Binance não estão ativas');
    }

    // 2️⃣ Validação: Quantidade ou quoteOrderQty?
    if (!dto.quantity && !dto.quoteOrderQty) {
      throw new BadRequestException(
        'Quantidade ou quoteOrderQty deve ser fornecido',
      );
    }

    if (dto.quantity && dto.quoteOrderQty) {
      throw new BadRequestException(
        'Não é possível enviar quantity e quoteOrderQty simultaneamente',
      );
    }

    // 3️⃣ Descriptografar credenciais
    const apiKey = CryptoUtil.decrypt(credentials.apiKey);
    const apiSecret = CryptoUtil.decrypt(credentials.apiSecret);

    // 4️⃣ Validação de saldo para BUY orders
    const balanceError = await this.validateBalance(
      userId,
      dto.side,
      dto.symbol,
      dto.quoteOrderQty,
    );
    if (balanceError) {
      throw new BadRequestException(balanceError);
    }

    // 5️⃣ Validações de saldo e credenciais já foram feitas acima
    // Validar filtros de LOT_SIZE e MIN_NOTIONAL
    try {
      let notional = 0;

      if (dto.quantity) {
        // Para calcular preço médio de compra/venda, precisamos do preço atual
        // Vamos usar a chamada sem assinatura ao /api/v3/ticker/price
        const tickerResponse = await this.binanceClient.unsignedGet<{
          symbol: string;
          price: string;
        }>('/api/v3/ticker/price', { symbol: dto.symbol });

        const price = parseFloat(tickerResponse.price);
        const qty = parseFloat(dto.quantity);
        notional = qty * price;

        this.logger.debug(
          `[placeMarketOrder] Validando quantity: ${dto.quantity}, price: ${price}, notional: ${notional}`,
        );

        await this.binanceClient.validateOrderQuantity(
          dto.symbol,
          dto.quantity,
          tickerResponse.price,
        );
      } else if (dto.quoteOrderQty) {
        // Para quoteOrderQty, o valor notional é exatamente o quoteOrderQty
        notional = parseFloat(dto.quoteOrderQty);

        this.logger.debug(
          `[placeMarketOrder] Validando quoteOrderQty: ${dto.quoteOrderQty}, notional: ${notional}`,
        );

        // Validar o mínimo notional diretamente
        const filters = await this.binanceClient.getSymbolFilters(dto.symbol);
        const notionalFilter = filters.find(
          (f: any) => f.filterType === 'NOTIONAL',
        );

        if (notionalFilter) {
          const minNotional = parseFloat(notionalFilter.minNotional);
          if (notional < minNotional) {
            throw new BadRequestException(
              `Valor total da ordem ${notional.toFixed(2)} USDT é menor que o mínimo ${minNotional} USDT para ${dto.symbol}`,
            );
          }
        }
      }
    } catch (e: any) {
      throw new BadRequestException(
        e?.message || 'Erro ao validar filtros de quantidade',
      );
    }

    // 6️⃣ Preparar parâmetros para Binance
    const binanceParams = {
      symbol: dto.symbol,
      side: dto.side,
      type: 'MARKET',
      ...(dto.quantity && { quantity: dto.quantity }),
      ...(dto.quoteOrderQty && { quoteOrderQty: dto.quoteOrderQty }),
    };

    try {
      // 7️⃣ Chamar Binance API
      this.logger.log(`Colocando ordem: ${JSON.stringify(binanceParams)}`);

      const binanceResponse = await this.binanceClient.signedPost<any>(
        '/api/v3/order',
        apiKey,
        apiSecret,
        binanceParams,
      );

      // 6️⃣ Persistir em transação
      const result = await this.prisma.$transaction(async (tx) => {
        // Criar registro de order
        const order = await tx.order.create({
          data: {
            userId,
            orderId: BigInt(binanceResponse.orderId),
            clientOrderId: binanceResponse.clientOrderId,
            symbol: binanceResponse.symbol,
            side: binanceResponse.side,
            type: 'MARKET',
            status: binanceResponse.status,
            quantity: binanceResponse.origQty,
            executedQty: binanceResponse.executedQty || '0',
            cumulativeQuoteQty: binanceResponse.cummulativeQuoteQty || '0',
            transactTime: new Date(binanceResponse.transactTime),
          },
        });

        // Log da ação
        await tx.orderLog.create({
          data: {
            userId,
            orderId: BigInt(binanceResponse.orderId),
            action: 'PLACE',
            status: 'SUCCESS',
            message: 'Ordem colocada com sucesso',
            responseData: binanceResponse,
          },
        });

        // Se a ordem veio com trades (MARKET order), sincronizar
        if (binanceResponse.fills && binanceResponse.fills.length > 0) {
          await this.syncTradesFromFills(tx, userId, binanceResponse);
        }

        return order;
      });

      this.logger.log(`Ordem colocada com sucesso: orderId=${result.orderId}`);

      // Sincronizar saldos após ordem bem-sucedida
      try {
        await this.walletService.syncSpotBalances(userId);
        this.logger.log(`Saldos sincronizados para usuário ${userId}`);
      } catch (syncError) {
        this.logger.error(
          `Erro ao sincronizar saldos após ordem: ${syncError.message}`,
          syncError.stack,
        );
        // Não propaga o erro - a ordem foi executada com sucesso
      }

      return {
        orderId: result.orderId.toString(),
        clientOrderId: result.clientOrderId,
        symbol: result.symbol,
        side: result.side,
        type: result.type,
        status: result.status,
        quantity: result.quantity.toString(),
        executedQty: result.executedQty.toString(),
        cumulativeQuoteQty: result.cumulativeQuoteQty.toString(),
        fills: binanceResponse.fills,
        transactTime: result.transactTime,
        createdAt: result.createdAt,
      };
    } catch (error) {
      // 8️⃣ Tratar erros
      this.logger.error(
        `Falha ao colocar ordem: ${error.message}`,
        error.stack,
      );

      // Log de erro
      await this.prisma.orderLog.create({
        data: {
          userId,
          orderId: BigInt(0), // 0 para indicar que não foi criada
          action: 'PLACE',
          status: 'FAILURE',
          message: error.message,
          requestData: binanceParams,
          responseData: error.response?.data,
        },
      });

      // Usar handler centralizado de erros
      BinanceErrorHandler.handle(error);
    }
  }

  /**
   * Sincronizar trades do response de MARKET order
   */
  private async syncTradesFromFills(
    tx: any,
    userId: string,
    binanceResponse: any,
  ) {
    const fills = binanceResponse.fills || [];

    for (const fill of fills) {
      // Calcular quoteQuantity se não vier da Binance
      const quoteQuantity =
        fill.quoteQty ||
        (parseFloat(fill.price) * parseFloat(fill.qty)).toString();

      await tx.trade.upsert({
        where: {
          userId_symbol_tradeId: {
            userId,
            symbol: binanceResponse.symbol,
            tradeId: BigInt(fill.tradeId),
          },
        },
        create: {
          userId,
          symbol: binanceResponse.symbol,
          tradeId: BigInt(fill.tradeId),
          orderId: BigInt(binanceResponse.orderId),
          price: fill.price,
          quantity: fill.qty,
          quoteQuantity: quoteQuantity,
          commission: fill.commission,
          commissionAsset: fill.commissionAsset,
          isBuyer: fill.side === 'BUY',
          isMaker: fill.isMaker || false,
          executedTime: new Date(binanceResponse.transactTime),
        },
        update: {
          lastSyncAt: new Date(),
        },
      });
    }
  }

  /**
   * Consultar status de uma ordem
   */
  async getOrder(userId: string, orderId: bigint): Promise<any> {
    const order = await this.prisma.order.findUnique({
      where: {
        userId_orderId: {
          userId,
          orderId,
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Ordem não encontrada');
    }

    return {
      orderId: order.orderId.toString(),
      clientOrderId: order.clientOrderId,
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      status: order.status,
      quantity: order.quantity.toString(),
      executedQty: order.executedQty.toString(),
      cumulativeQuoteQty: order.cumulativeQuoteQty.toString(),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  /**
   * Listar ordens do usuário
   */
  async listOrders(
    userId: string,
    query: ListOrdersQueryDto,
  ): Promise<ListOrdersResponseDto> {
    const { symbol, limit = 100, page = 1 } = query;

    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          userId,
          symbol,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.order.count({
        where: {
          userId,
          symbol,
        },
      }),
    ]);

    return {
      total,
      orders: orders.map((order) => ({
        orderId: order.orderId.toString(),
        clientOrderId: order.clientOrderId,
        symbol: order.symbol,
        side: order.side,
        type: order.type,
        status: order.status,
        quantity: order.quantity.toString(),
        executedQty: order.executedQty.toString(),
        cumulativeQuoteQty: order.cumulativeQuoteQty.toString(),
        createdAt: order.createdAt,
      })),
    };
  }
}
