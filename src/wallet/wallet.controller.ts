import {
  Body,
  Controller,
  Delete,
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
import {
  ListTradesQueryDto,
  ListTradesResponse,
  SyncTradesResponse,
  TradeStatsDto,
  AllTradesSyncResponse,
  WalletTradesSummaryDto,
} from './dto/trade.dto';
import { WalletService } from './wallet.service';
import { TradeService } from './trade.service';
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
  constructor(
    private readonly walletService: WalletService,
    private readonly tradeService: TradeService,
  ) {}
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

  // ==================== TRADES ENDPOINTS ====================

  @ApiOperation({
    summary: 'Sincronizar histórico completo de trades de um símbolo',
    description: `
    Sincroniza TODOS os trades históricos de um símbolo desde o início da conta.
    
    Este endpoint faz múltiplas requisições à API da Binance usando paginação com 'fromId'
    para trazer todo o histórico de trades, sem limites de tempo (diferente da interface web que mostra apenas 6 meses).
    
    Os dados são armazenados no banco de dados para análise posterior.
    
    **Notas importantes:**
    - A sincronização pode levar alguns segundos dependendo do volume de trades
    - Trades duplicadas não serão armazenadas duas vezes (usa upsert)
    - Recomenda-se sincronizar um símbolo por vez para melhor controle
    `,
  })
  @ApiCreatedResponse({
    type: SyncTradesResponse,
    description: 'Histórico de trades sincronizado com sucesso',
    schema: {
      example: {
        synced: 150,
        totalInDatabase: 1500,
        symbol: 'BTCUSDT',
        hasMore: false,
        lastSyncedTradeTime: '2025-11-17T23:30:00.000Z',
      },
    },
  })
  @Post('sync/trades')
  async syncTrades(
    @Req() req,
    @Query('symbol') symbol: string,
  ): Promise<SyncTradesResponse> {
    const userId = req.user?.userId ?? req.user?.id ?? req.user?.sub;

    if (!symbol) {
      throw new Error('Parâmetro "symbol" é obrigatório');
    }

    this.logger.log(`Iniciando sincronização de trades para ${symbol}`);
    return this.tradeService.syncTradesForSymbol(userId, symbol);
  }

  @ApiOperation({
    summary: 'Sincronizar trades de múltiplos símbolos',
    description: `
    Sincroniza o histórico de trades para vários símbolos simultaneamente.
    
    **Exemplo de uso:**
    \`\`\`
    POST /wallet/sync/trades/batch
    {
      "symbols": ["BTCUSDT", "ETHUSDT", "BNBUSDT"]
    }
    \`\`\`
    `,
  })
  @ApiBody({
    schema: {
      example: {
        symbols: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'],
      },
    },
  })
  @ApiOkResponse({
    description: 'Sincronização de múltiplos símbolos',
    schema: {
      example: [
        {
          synced: 150,
          totalInDatabase: 1500,
          symbol: 'BTCUSDT',
          hasMore: false,
        },
        {
          synced: 250,
          totalInDatabase: 2500,
          symbol: 'ETHUSDT',
          hasMore: false,
        },
      ],
    },
  })
  @Post('sync/trades/batch')
  async syncTradesBatch(
    @Req() req,
    @Body('symbols') symbols: string[],
  ): Promise<any[]> {
    const userId = req.user?.userId ?? req.user?.id ?? req.user?.sub;

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      throw new Error(
        'Array "symbols" é obrigatório e deve conter pelo menos um símbolo',
      );
    }

    this.logger.log(
      `Iniciando sincronização de trades para ${symbols.length} símbolos`,
    );
    return this.tradeService.syncTradesForMultipleSymbols(userId, symbols);
  }

  @ApiOperation({
    summary: 'Listar trades com filtros e paginação',
    description: `
    Lista os trades armazenados no banco de dados com suporte a:
    - Filtros por data
    - Filtros por tipo (compra/venda)
    - Paginação completa
    - Ordenação por data
    
    **Exemplos:**
    
    Últimos 50 trades:
    \`/wallet/trades?symbol=BTCUSDT&page=1&limit=50\`
    
    Trades de uma data específica:
    \`/wallet/trades?symbol=BTCUSDT&startDate=2025-01-01&endDate=2025-01-31\`
    
    Apenas compras:
    \`/wallet/trades?symbol=BTCUSDT&type=BUY&limit=100\`
    `,
  })
  @ApiOkResponse({ type: ListTradesResponse })
  @Get('trades')
  async listTrades(
    @Req() req,
    @Query() query: ListTradesQueryDto,
  ): Promise<ListTradesResponse> {
    const userId = req.user?.userId ?? req.user?.id ?? req.user?.sub;

    if (!query.symbol) {
      throw new Error('Parâmetro "symbol" é obrigatório');
    }

    return this.tradeService.listTrades(userId, query);
  }

  @ApiOperation({
    summary: 'Obter estatísticas de trades de um símbolo',
    description: `
    Retorna estatísticas agregadas de um símbolo:
    - Total de trades
    - Total de compras vs vendas
    - Comissão total paga
    - Data do primeiro e último trade
    `,
  })
  @ApiOkResponse({ type: TradeStatsDto })
  @Get('trades/stats')
  async getTradeStats(
    @Req() req,
    @Query('symbol') symbol: string,
  ): Promise<TradeStatsDto> {
    const userId = req.user?.userId ?? req.user?.id ?? req.user?.sub;

    if (!symbol) {
      throw new Error('Parâmetro "symbol" é obrigatório');
    }

    return this.tradeService.getTradeStats(userId, symbol);
  }

  // ==================== NOVAS FUNCIONALIDADES ====================

  @ApiOperation({
    summary: 'Sincronizar TODAS as trades históricas da carteira',
    description: `
    Sincroniza o histórico COMPLETO de todas as trades da sua carteira Binance.
    
    Este endpoint:
    1. Descobre automaticamente todos os símbolos USDT disponíveis na exchange
    2. Sincroniza o histórico completo de cada símbolo
    3. Armazena tudo no banco de dados para análise
    
    **Importante:**
    - Esta operação pode levar alguns minutos se você tem muitas trades
    - Não é necessário fornecer os símbolos - o sistema descobre automaticamente
    - Trades duplicadas não serão armazenadas duas vezes (usa upsert)
    
    **Resposta inclui:**
    - Total de trades sincronizadas
    - Total de símbolos processados
    - Resumo de sucessos e falhas
    `,
  })
  @ApiCreatedResponse({
    type: AllTradesSyncResponse,
    description: 'Sincronização completa de todas as trades',
  })
  @Post('sync/trades/all')
  async syncAllTrades(@Req() req): Promise<any> {
    const userId = req.user?.userId ?? req.user?.id ?? req.user?.sub;

    this.logger.log(
      `Iniciando sincronização COMPLETA de todas as trades para ${userId}`,
    );
    return this.tradeService.syncAllTradesForWallet(userId);
  }

  @ApiOperation({
    summary: 'Obter resumo completo do histórico de trades da carteira',
    description: `
    Retorna um resumo consolidado de TODAS as trades históricas da sua carteira.
    
    **Informações retornadas:**
    - Total de trades em toda a carteira
    - Total de símbolos diferentes negociados
    - Contagem de compras vs vendas
    - Comissão total paga
    - Data da primeira e última trade
    - Breakdown por símbolo
    
    Esta é uma excelente forma de ver um overview rápido do seu histórico de trades.
    `,
  })
  @ApiOkResponse({
    type: WalletTradesSummaryDto,
    description: 'Resumo completo do histórico de trades',
  })
  @Get('trades/summary')
  async getTradesSummary(@Req() req): Promise<any> {
    const userId = req.user?.userId ?? req.user?.id ?? req.user?.sub;

    this.logger.log(`Gerando resumo de trades para ${userId}`);
    return this.tradeService.getWalletTradesSummary(userId);
  }

  @ApiOperation({
    summary: 'Deletar todos os trades de um usuário',
    description:
      'Remove todos os trades armazenados no banco. Esta ação é irreversível.',
  })
  @ApiOkResponse({
    schema: {
      example: {
        deleted: 1500,
      },
    },
  })
  @Delete('trades')
  async deleteAllTrades(@Req() req): Promise<any> {
    const userId = req.user?.userId ?? req.user?.id ?? req.user?.sub;

    this.logger.warn(`Usuário ${userId} está deletando todos os trades`);
    return this.tradeService.deleteAllTrades(userId);
  }
}
