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

  @ApiOperation({ summary: 'Colocar uma nova ordem MARKET de compra ou venda' })
  @ApiBody({ type: PlaceOrderDto })
  @ApiCreatedResponse({
    description: 'Ordem colocada com sucesso',
    type: PlaceOrderResponseDto,
    schema: {
      example: {
        orderId: 12345,
        clientOrderId: 'myOrder1',
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
          },
        ],
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Erro na validação ou falta de saldo',
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

  @ApiOperation({ summary: 'Obter detalhes de uma ordem executada' })
  @ApiOkResponse({
    description: 'Detalhes da ordem',
    schema: {
      example: {
        orderId: 12345,
        clientOrderId: 'myOrder1',
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'MARKET',
        status: 'FILLED',
        quantity: '0.001',
        executedQty: '0.001',
        cumulativeQuoteQty: '45123.50',
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Ordem não encontrada' })
  @Get('orders/:orderId')
  async getOrder(
    @Req() req,
    @Param('orderId') orderId: string,
    @Query('symbol') symbol: string,
  ) {
    if (!symbol) {
      throw new Error('Parâmetro "symbol" é obrigatório');
    }

    const userId = req.user?.userId ?? req.user?.id ?? req.user?.sub;
    return this.tradeService.getOrder(userId, BigInt(orderId), symbol);
  }

  @ApiOperation({ summary: 'Listar histórico de ordens executadas' })
  @ApiOkResponse({
    description: 'Lista de ordens com paginação',
    type: ListOrdersResponseDto,
    schema: {
      example: {
        total: 25,
        orders: [
          {
            orderId: 12345,
            clientOrderId: 'myOrder1',
            symbol: 'BTCUSDT',
            side: 'BUY',
            type: 'MARKET',
            status: 'FILLED',
            quantity: '0.001',
            executedQty: '0.001',
            cumulativeQuoteQty: '45123.50',
          },
        ],
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
