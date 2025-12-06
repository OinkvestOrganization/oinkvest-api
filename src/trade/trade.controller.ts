import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { TradeService } from './trade.service';
import {
  PlaceOrderDto,
  PlaceOrderResponseDto,
  ListOrdersQueryDto,
  ListOrdersResponseDto,
} from './dto';
import { JwtAuthGuard } from '@/auth/guard/jwt-auth.guard';

@ApiTags('Trade')
@ApiBearerAuth()
@Controller('trade')
@UseGuards(JwtAuthGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }),
)
export class TradeController {
  private readonly logger = new Logger(TradeController.name);

  constructor(private readonly tradeService: TradeService) {}

  @ApiOperation({
    summary: 'Colocar uma nova ordem MARKET de compra ou venda',
    description: `
    Executa uma ordem MARKET na Binance com validações:
    - Verifica se o usuário possui credenciais Binance ativas
    - Valida saldo USDT disponível (para ordens BUY)
    - Valida filtros de quantidade (LOT_SIZE) do exchange
    - Persiste ordem e trades em transação
    
    **Parâmetros obrigatórios:**
    - \`symbol\`: Par de negociação (ex: BTCUSDT, ETHUSDT)
    - \`side\`: BUY ou SELL
    - \`quantity\` OU \`quoteOrderQty\`: Um deles deve ser fornecido (não ambos)
      - \`quantity\`: Quantidade em moeda base (ex: 0.001 BTC)
      - \`quoteOrderQty\`: Valor em USDT (ex: 45.50)
    
    **Exemplo de uso:**
    - BUY com quantidade: symbol=BTCUSDT, side=BUY, quantity=0.001
    - BUY com valor: symbol=BTCUSDT, side=BUY, quoteOrderQty=45.50
    - SELL com quantidade: symbol=BTCUSDT, side=SELL, quantity=0.001
    `,
  })
  @ApiBody({
    type: PlaceOrderDto,
    description: 'Dados da ordem MARKET',
    examples: {
      buyWithQuantity: {
        summary: 'Comprar',
        value: {
          symbol: 'BTCUSDT',
          side: 'BUY',
          quantity: '0.001',
        },
      },
      sell: {
        summary: 'Vender',
        value: {
          symbol: 'BTCUSDT',
          side: 'SELL',
          quantity: '0.001',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description:
      'Ordem executada com sucesso (MARKET order é executada imediatamente)',
    type: PlaceOrderResponseDto,
    schema: {
      example: {
        orderId: '8389765432123456',
        clientOrderId: 'myOrder1701388838000',
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'MARKET',
        status: 'FILLED',
        quantity: '0.001',
        executedQty: '0.001',
        cumulativeQuoteQty: '45123.50',
        fills: [
          {
            price: '45123.50',
            qty: '0.001',
            commission: '0.00004512',
            commissionAsset: 'USDT',
            isMaker: false,
          },
        ],
        transactTime: '2025-12-01T12:00:00.000Z',
        createdAt: '2025-12-01T12:00:00.000Z',
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      'Erro de validação (saldo insuficiente, quantidade inválida, credenciais inativas, etc)',
    schema: {
      example: {
        statusCode: 400,
        message:
          'Saldo USDT insuficiente. Disponível: 10.00, Necessário: 45.50',
        error: 'Bad Request',
      },
    },
  })
  @Post('orders')
  @HttpCode(HttpStatus.CREATED)
  async placeOrder(@Req() req, @Body() dto: PlaceOrderDto) {
    const userId = req.user?.userId ?? req.user?.id ?? req.user?.sub;
    this.logger.log(
      `Colocando ordem para user ${userId}: ${dto.symbol} ${dto.side}`,
    );
    return this.tradeService.placeMarketOrder(userId, dto);
  }

  @ApiOperation({
    summary: 'Obter detalhes de uma ordem executada',
    description: `
    Recupera os detalhes completos de uma ordem específica pelo orderId.
    
    A ordem deve pertencer ao usuário autenticado.
    `,
  })
  @ApiOkResponse({
    description: 'Detalhes da ordem encontrada',
    type: PlaceOrderResponseDto,
    schema: {
      example: {
        orderId: '8389765432123456',
        clientOrderId: 'myOrder1701388838000',
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'MARKET',
        status: 'FILLED',
        quantity: '0.001',
        executedQty: '0.001',
        cumulativeQuoteQty: '45123.50',
        createdAt: '2025-12-01T12:00:00.000Z',
        updatedAt: '2025-12-01T12:00:00.000Z',
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Ordem não encontrada',
    schema: {
      example: {
        statusCode: 404,
        message: 'Ordem não encontrada',
        error: 'Not Found',
      },
    },
  })
  @Get('orders/:orderId')
  async getOrder(@Req() req, @Param('orderId') orderId: string) {
    const userId = req.user?.userId ?? req.user?.id ?? req.user?.sub;

    if (!orderId || typeof orderId !== 'string' || orderId.trim() === '') {
      throw new BadRequestException('orderId inválido');
    }

    try {
      return this.tradeService.getOrder(userId, BigInt(orderId));
    } catch (error) {
      throw new BadRequestException('orderId deve ser um número válido');
    }
  }

  @ApiOperation({
    summary: 'Listar histórico de ordens executadas',
    description: `
    Lista todas as ordens MARKET executadas do usuário com paginação e filtros.
    
    **Parâmetros de query:**
    - \`symbol\` (obrigatório): Par de negociação para filtrar (ex: BTCUSDT)
    - \`limit\` (opcional): Quantidade de ordens por página (padrão: 100, máximo: 500)
    - \`page\` (opcional): Número da página (padrão: 1)
    
    **Ordenação:** Por data de criação (mais recentes primeiro)
    
    **Exemplo de URLs:**
    - \`/trade/orders?symbol=BTCUSDT\`
    - \`/trade/orders?symbol=BTCUSDT&limit=50&page=2\`
    - \`/trade/orders?symbol=ETHUSDT&limit=25\`
    `,
  })
  @ApiOkResponse({
    description: 'Lista de ordens paginada',
    type: ListOrdersResponseDto,
    schema: {
      example: {
        total: 25,
        orders: [
          {
            orderId: '8389765432123456',
            clientOrderId: 'myOrder1701388838000',
            symbol: 'BTCUSDT',
            side: 'BUY',
            type: 'MARKET',
            status: 'FILLED',
            quantity: '0.001',
            executedQty: '0.001',
            cumulativeQuoteQty: '45123.50',
            createdAt: '2025-12-01T12:00:00.000Z',
          },
          {
            orderId: '8389765432123457',
            clientOrderId: 'myOrder1701388900000',
            symbol: 'BTCUSDT',
            side: 'SELL',
            type: 'MARKET',
            status: 'FILLED',
            quantity: '0.001',
            executedQty: '0.001',
            cumulativeQuoteQty: '46200.75',
            createdAt: '2025-11-30T15:30:00.000Z',
          },
        ],
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Parâmetro "symbol" é obrigatório',
    schema: {
      example: {
        statusCode: 400,
        message: 'Parâmetro "symbol" é obrigatório',
        error: 'Bad Request',
      },
    },
  })
  @Get('orders')
  async listOrders(@Req() req, @Query() query: ListOrdersQueryDto) {
    if (!query.symbol) {
      throw new Error('Parâmetro "symbol" é obrigatório');
    }

    const userId = req.user?.userId ?? req.user?.id ?? req.user?.sub;
    return this.tradeService.listOrders(userId, query);
  }
}
