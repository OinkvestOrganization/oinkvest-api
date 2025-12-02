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
/**
 * 🎯 FLUXO RECOMENDADO DE USO DO MÓDULO WALLET:
 *
 * 1️⃣ PRIMEIRAMENTE - Salvar credenciais:
 *    POST /wallet/credentials
 *    - Salva suas credenciais da Binance (API Key + Secret) de forma criptografada
 *
 * 2️⃣ SINCRONIZAR CARTEIRA - Trazer saldos atualizados:
 *    POST /wallet/sync/balances
 *    - Sincroniza TODOS os seus ativos e saldos (Spot) da Binance
 *    - Armazena no banco de dados
 *
 * 3️⃣ SINCRONIZAR HISTÓRICO DE TRADES (Recomendado):
 *    POST /wallet/sync/trades/wallet ⭐ RECOMENDADO
 *    - Sincroniza TODAS as trades históricas APENAS dos ativos em sua carteira
 *    - Mais eficiente que sincronizar todos os símbolos
 *
 *    Alternativa (menos recomendada):
 *    POST /wallet/sync/trades/all
 *    - Sincroniza TODAS as trades de TODOS os símbolos USDT (pode levar muito tempo)
 *
 *    Ou específico:
 *    POST /wallet/sync/trades?symbol=BTCUSDT
 *    - Sincroniza trades de um símbolo específico
 *
 * 4️⃣ CONSULTAR DADOS:
 *    GET /wallet/balances - Listar saldos persistidos
 *    GET /wallet/trades - Listar trades
 *    GET /wallet/trades/stats - Estatísticas de um símbolo
 *    GET /wallet/trades/summary - Resumo completo da carteira
 *
 * ⚠️ IMPORTANTE:
 * - Sempre execute os passos na ordem acima
 * - Não confunda os endpoints: /sync/trades/wallet (recomendado) com /sync/trades/all (não recomendado)
 * - O endpoint /sync/trades/wallet sincroniza APENAS ativos da carteira (mais rápido)
 * - O endpoint /sync/trades/all sincroniza TODOS os símbolos USDT (muito lento)
 */
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
    Sincroniza TODOS os trades históricos de um SÍMBOLO ESPECÍFICO desde o início da conta.
    
    Este endpoint é útil quando:
    - Você quer sincronizar apenas um ativo específico
    - Você quer resincronizar um ativo depois de já ter sincronizado
    - Você quer testar a sincronização com um símbolo específico
    
    Este endpoint faz múltiplas requisições à API da Binance usando paginação com 'fromId'
    para trazer todo o histórico de trades, sem limites de tempo (diferente da interface web que mostra apenas 6 meses).
    
    Os dados são armazenados no banco de dados para análise posterior.
    
    **Notas importantes:**
    - A sincronização pode levar alguns segundos dependendo do volume de trades
    - Trades duplicadas não serão armazenadas duas vezes (usa upsert)
    - Recomenda-se sincronizar um símbolo por vez para melhor controle
    
    **Exemplo de uso:**
    POST /wallet/sync/trades?symbol=BTCUSDT
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
    summary: 'Sincronizar trades de múltiplos símbolos específicos',
    description: `
    Sincroniza o histórico de trades para vários símbolos ESPECÍFICOS que você informar.
    
    Útil quando:
    - Você quer sincronizar um conjunto específico de ativos
    - Você não quer sincronizar TODOS os ativos da exchange ou da carteira
    - Você está testando a sincronização
    
    **Exemplo de uso:**
    \`\`\`
    POST /wallet/sync/trades/batch
    {
      "symbols": ["BTCUSDT", "ETHUSDT", "BNBUSDT"]
    }
    \`\`\`
    
    **Notas:**
    - Passe os símbolos exatamente como aparecem na Binance (ex: BTCUSDT, não BTC)
    - Esta operação sincroniza os símbolos sequencialmente
    - Trades duplicadas não são armazenadas duas vezes (usa upsert)
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
    summary:
      'Sincronizar trades históricas dos ATIVOS DA CARTEIRA (RECOMENDADO)',
    description: `
    🎯 ESTE É O ENDPOINT RECOMENDADO para sincronizar seu histórico de trades!
    
    Sincroniza o histórico COMPLETO de trades APENAS dos ativos que estão em sua carteira com saldo > 0.
    
    Este endpoint:
    1. Consulta seu banco de dados para obter os ativos com saldo (WalletBalance)
    2. Para cada ativo, sincroniza o histórico completo de trades usando paginação fromId
    3. Armazena tudo no banco de dados para análise profunda
    
    **PRÉ-REQUISITO:**
    - Você deve executar \`POST /wallet/sync/balances\` PRIMEIRO para registrar seus ativos em carteira
    
    **Características:**
    - ✅ Sincroniza APENAS os ativos que você tem em carteira
    - ✅ SEM limite de tempo (API Binance não limita, diferente da web interface 6 meses)
    - ✅ Sem precisar informar símbolos - descobre automaticamente da sua carteira
    - ✅ Trades duplicadas não são armazenadas duas vezes (usa upsert)
    - ✅ Processamento robusto com retry de tempo
    - ✅ Mais eficiente que sincronizar TODOS os símbolos da exchange
    
    **Importante:**
    - Esta operação pode levar ALGUNS MINUTOS se você tem muitas trades
    - O sistema sincroniza em background, você pode consultar o progresso
    - Recomenda-se não interromper até a conclusão
    
    **Resposta inclui:**
    - Total de trades sincronizadas nesta execução
    - Total geral de trades no banco para todos os símbolos
    - Total de símbolos processados
    - Resumo detalhado de sucessos e falhas por símbolo
    
    **Fluxo recomendado:**
    1. POST /wallet/credentials (salvar credenciais)
    2. POST /wallet/sync/balances (sincronizar seus ativos)
    3. POST /wallet/sync/trades/wallet (sincronizar trades dos ativos) ← ESTE ENDPOINT
    `,
  })
  @ApiCreatedResponse({
    type: AllTradesSyncResponse,
    description: 'Sincronização de trades dos ativos em carteira',
  })
  @Post('sync/trades/wallet')
  async syncWalletTrades(@Req() req): Promise<any> {
    const userId = req.user?.userId ?? req.user?.id ?? req.user?.sub;

    this.logger.log(
      `Iniciando sincronização de trades dos ATIVOS DA CARTEIRA para ${userId}`,
    );
    return this.tradeService.syncAllTradesForWallet(userId);
  }

  @ApiOperation({
    summary:
      'Sincronizar TODAS as trades de TODOS os símbolos USDT (NÃO RECOMENDADO)',
    description: `
    ⚠️ CUIDADO: Este endpoint sincroniza TODOS os símbolos USDT da exchange Binance (milhares de pares).
    Na maioria dos casos, você quer usar POST /wallet/sync/trades/wallet ao invés disso!
    
    Sincroniza o histórico COMPLETO de TODAS as trades de TODOS os pares USDT disponíveis na Binance.
    
    Este endpoint:
    1. Descobre TODOS os símbolos USDT disponíveis para Spot Trading na exchange
    2. Para cada símbolo, sincroniza o histórico completo usando paginação fromId
    3. Armazena tudo no banco de dados
    
    **Quando usar:**
    - Você quer um histórico COMPLETO de TODAS as suas transações
    - Você quer dados de análise de ativos que você não tem mais em carteira
    
    **Quando NÃO usar (caso mais comum):**
    - Se você quer sincronizar apenas os ativos que estão em sua carteira: use POST /wallet/sync/trades/wallet
    
    **Características:**
    - ✅ Sincroniza TODOS os símbolos USDT disponíveis
    - ⚠️ Pode levar VÁRIOS MINUTOS (muitos símbolos)
    - ⚠️ Alto volume de requisições à API da Binance
    - ✅ Trades duplicadas não são armazenadas duas vezes (usa upsert)
    
    **Importante:**
    - Esta operação pode levar MUITOS MINUTOS
    - O sistema sincroniza em background
    - Recomenda-se não interromper até a conclusão
    
    **Resposta inclui:**
    - Total de trades sincronizadas nesta execução
    - Total geral de trades no banco para TODOS os símbolos
    - Total de símbolos processados
    - Resumo detalhado de sucessos e falhas
    `,
  })
  @ApiCreatedResponse({
    type: AllTradesSyncResponse,
    description: 'Sincronização completa de TODAS as trades',
  })
  @Post('sync/trades/all')
  async syncAllTrades(@Req() req): Promise<any> {
    const userId = req.user?.userId ?? req.user?.id ?? req.user?.sub;

    this.logger.log(
      `Iniciando sincronização COMPLETA de TODAS as trades para ${userId}`,
    );
    return this.tradeService.syncAllTradesForWalletAllSymbols(userId);
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
