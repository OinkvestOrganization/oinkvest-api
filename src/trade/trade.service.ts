import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { BinanceRestClientService } from '@/binance/binance-rest-client.service';
import { CryptoUtil } from '@/common/utils/crypto.util';
import {
  PlaceOrderDto,
  PlaceOrderResponseDto,
  ListOrdersQueryDto,
  ListOrdersResponseDto,
} from './dto';

@Injectable()
export class TradeService {
  private readonly logger = new Logger(TradeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly binanceClient: BinanceRestClientService,
  ) {}

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

    // 4️⃣ Preparar parâmetros para Binance
    const binanceParams = {
      symbol: dto.symbol,
      side: dto.side,
      type: 'MARKET',
      ...(dto.quantity && { quantity: dto.quantity }),
      ...(dto.quoteOrderQty && { quoteOrderQty: dto.quoteOrderQty }),
      newOrderRespType: 'FULL', // Resposta detalhada
    };

    try {
      // 5️⃣ Chamar Binance API
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

      return {
        orderId: result.orderId,
        clientOrderId: result.clientOrderId,
        symbol: result.symbol,
        side: result.side,
        type: result.type,
        status: result.status,
        quantity: result.quantity,
        executedQty: result.executedQty,
        cumulativeQuoteQty: result.cumulativeQuoteQty,
        fills: binanceResponse.fills,
        transactTime: result.transactTime,
        createdAt: result.createdAt,
      };
    } catch (error) {
      // 7️⃣ Tratar erros
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

      // Mapear erros específicos da Binance
      const binanceError = error.response?.data;
      if (binanceError?.code === -2010) {
        throw new BadRequestException(
          'Saldo insuficiente para realizar a operação',
        );
      }
      if (binanceError?.code === -1013) {
        throw new BadRequestException('Quantidade inválida para este par');
      }
      if (binanceError?.code === -1003) {
        throw new BadRequestException(
          'Limite de requisições atingido. Tente novamente em breve.',
        );
      }

      throw new BadRequestException(`Erro Binance: ${error.message}`);
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
          quoteQuantity: fill.quoteQty,
          commission: fill.commission,
          commissionAsset: fill.commissionAsset,
          isBuyer: fill.side === 'BUY',
          isMaker: fill.isMaker,
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
  async getOrder(
    userId: string,
    orderId: bigint,
    symbol: string,
  ): Promise<any> {
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
      orderId: order.orderId,
      clientOrderId: order.clientOrderId,
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      status: order.status,
      quantity: order.quantity,
      executedQty: order.executedQty,
      cumulativeQuoteQty: order.cumulativeQuoteQty,
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
        orderId: order.orderId,
        clientOrderId: order.clientOrderId,
        symbol: order.symbol,
        side: order.side,
        type: order.type,
        status: order.status,
        quantity: order.quantity,
        executedQty: order.executedQty,
        cumulativeQuoteQty: order.cumulativeQuoteQty,
        createdAt: order.createdAt,
      })),
    };
  }
}
