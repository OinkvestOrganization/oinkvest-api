import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CreateExchangeCredentialDto } from './dto/create-exchange-credential.dto';
import { ListBalancesQueryDto } from './dto/list-balances.query.dto';
import { SyncBalancesResponse } from './dto/sync-balances.response';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';

@ApiTags('Wallet')
@ApiBearerAuth()
@Controller('wallet')
@UseGuards(JwtAuthGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true, // ignora campos extras
    transform: true, // aplica @Transform e converte tipos
    transformOptions: { enableImplicitConversion: true },
  }),
)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}
  private readonly logger = new Logger(WalletController.name);

  @ApiOperation({
    summary: 'Salvar/atualizar credenciais da Binance (armazenadas cifradas)',
  })
  @ApiBody({ type: CreateExchangeCredentialDto })
  @ApiCreatedResponse({
    description: 'Credenciais salvas (sem exibir secrets).',
    schema: {
      example: {
        id: 'cmhfhdcqx0001qua0zphvdcjz',
        userId: '5a1aaade-5799-44c3-a8e9-a85c7949fb8c',
        exchange: 'BINANCE',
        status: 'ACTIVE',
        createdAt: '2025-10-31T23:24:38.986Z',
        updatedAt: '2025-10-31T23:24:38.986Z',
      },
    },
  })
  @Post('credentials')
  saveCredentials(@Req() req, @Body() dto: CreateExchangeCredentialDto) {
    const userId = req.user?.userId ?? req.user?.id ?? req.user?.sub;
    this.logger.log('Salvando credenciais para user ' + userId);
    return this.walletService.upsertCredentials(userId, dto);
  }

  @ApiOperation({ summary: 'Obter status das credenciais' })
  @ApiOkResponse({
    description: 'Dados das credenciais (sem apiKey/apiSecret).',
    schema: {
      example: {
        id: 'cmhfhdcqx0001qua0zphvdcjz',
        exchange: 'BINANCE',
        status: 'ACTIVE',
        createdAt: '2025-10-31T23:24:38.986Z',
        updatedAt: '2025-10-31T23:24:38.986Z',
      },
    },
  })
  @Get('credentials')
  async getCredentials(@Req() req) {
    const userId = req.user?.userId ?? req.user?.id ?? req.user?.sub;
    return this.walletService.getCredential(userId);
  }

  @ApiOperation({
    summary: 'Consultar saldos diretamente na Binance (sem persistir)',
  })
  @ApiOkResponse({
    description: 'Lista de ativos com saldo (free/locked).',
    schema: {
      example: [
        { asset: 'USDT', free: '123.45', locked: '0.00' },
        { asset: 'BTC', free: '0.0032', locked: '0.0000' },
      ],
    },
  })
  @Get('binance/balances')
  async getUserBalances(@Req() req) {
    const userId = req.user?.userId ?? req.user?.id ?? req.user?.sub;
    return this.walletService.fetchUserBalances(userId);
  }

  @ApiOperation({
    summary: 'Sincronizar saldos Spot e persistir em WalletBalance',
  })
  @ApiOkResponse({ type: SyncBalancesResponse })
  @Post('sync/balances')
  syncBalances(@Req() req): Promise<SyncBalancesResponse> {
    const userId = req.user?.userId ?? req.user?.id ?? req.user?.sub;
    return this.walletService.syncSpotBalances(userId) as any;
  }

  @ApiOperation({
    summary: 'Listar saldos persistidos (com filtros/paginação)',
  })
  @ApiOkResponse({
    description: 'Saldos do banco, ordenados por total desc.',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          asset: { type: 'string', example: 'USDT' },
          free: { type: 'string', example: '123.45' },
          locked: { type: 'string', example: '0.00' },
          total: { type: 'string', example: '123.45' },
          lastSyncAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @Get('balances')
  async listBalances(@Req() req, @Query() query: ListBalancesQueryDto) {
    const userId = req.user?.userId ?? req.user?.id ?? req.user?.sub;
    return this.walletService.listBalances(userId, query);
  }
}
