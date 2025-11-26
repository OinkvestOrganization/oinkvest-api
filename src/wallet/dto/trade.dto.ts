import { ApiProperty } from '@nestjs/swagger';

export class TradeDto {
  @ApiProperty({
    example: 'cmhfhdcqx0001qua0zphvdcjz',
    description: 'ID único da trade no banco de dados',
  })
  id: string;

  @ApiProperty({
    example: 'BTCUSDT',
    description: 'Par de moedas negociado',
  })
  symbol: string;

  @ApiProperty({
    example: 28457,
    description: 'ID da trade retornado pela Binance',
  })
  tradeId: string | number;

  @ApiProperty({
    example: 100234,
    description: 'ID da ordem associada',
  })
  orderId: string | number;

  @ApiProperty({
    example: '4.00000100',
    description: 'Preço da execução',
  })
  price: string;

  @ApiProperty({
    example: '12.00000000',
    description: 'Quantidade executada',
  })
  quantity: string;

  @ApiProperty({
    example: '48.000012',
    description: 'Valor total (preço × quantidade)',
  })
  quoteQuantity: string;

  @ApiProperty({
    example: '10.10000000',
    description: 'Comissão cobrada',
  })
  commission: string;

  @ApiProperty({
    example: 'BNB',
    description: 'Ativo em que foi cobrada a comissão',
  })
  commissionAsset: string;

  @ApiProperty({
    example: true,
    description: 'true = compra, false = venda',
  })
  isBuyer: boolean;

  @ApiProperty({
    example: false,
    description: 'true = maker, false = taker',
  })
  isMaker: boolean;

  @ApiProperty({
    example: true,
    description: 'Se foi a melhor correspondência',
  })
  isBestMatch: boolean;

  @ApiProperty({
    example: 1499865549590,
    description: 'Timestamp de quando a trade foi executada (milissegundos)',
    format: 'date-time',
  })
  executedTime: Date;

  @ApiProperty({
    example: '2025-11-17T23:30:00.000Z',
    description: 'Última sincronização com a Binance',
    format: 'date-time',
  })
  lastSyncAt: Date;

  @ApiProperty({
    example: '2025-11-17T23:30:00.000Z',
    description: 'Data de criação do registro',
    format: 'date-time',
  })
  createdAt: Date;
}

export class SyncTradesResponse {
  @ApiProperty({
    example: 150,
    description: 'Total de trades sincronizados nesta execução',
  })
  synced: number;

  @ApiProperty({
    example: 1500,
    description: 'Total geral de trades no banco de dados para este símbolo',
  })
  totalInDatabase: number;

  @ApiProperty({
    example: 'BTCUSDT',
    description: 'Símbolo sincronizado',
  })
  symbol: string;

  @ApiProperty({
    example: false,
    description:
      'Indica se ainda há mais trades a sincronizar (há mais dados na Binance)',
  })
  hasMore: boolean;

  @ApiProperty({
    example: '2025-11-17T23:35:00.000Z',
    description: 'Timestamp da última trade sincronizada',
    format: 'date-time',
  })
  lastSyncedTradeTime?: Date;
}

export class ListTradesQueryDto {
  @ApiProperty({
    example: 'BTCUSDT',
    required: true,
    description: 'Símbolo/par para filtrar trades',
  })
  symbol: string;

  @ApiProperty({
    example: 1,
    required: false,
    description: 'Página para paginação (começa em 1)',
    minimum: 1,
  })
  page?: number;

  @ApiProperty({
    example: 50,
    required: false,
    description: 'Quantidade de registros por página',
    minimum: 1,
    maximum: 500,
  })
  limit?: number;

  @ApiProperty({
    example: '2025-01-01',
    required: false,
    description: 'Data inicial para filtro (YYYY-MM-DD)',
  })
  startDate?: string;

  @ApiProperty({
    example: '2025-11-17',
    required: false,
    description: 'Data final para filtro (YYYY-MM-DD)',
  })
  endDate?: string;

  @ApiProperty({
    example: 'BUY',
    required: false,
    enum: ['BUY', 'SELL', 'ALL'],
    description: 'Filtrar por tipo de operação',
  })
  type?: 'BUY' | 'SELL' | 'ALL';

  @ApiProperty({
    example: 'DESC',
    required: false,
    enum: ['ASC', 'DESC'],
    description: 'Ordenar por data de execução',
  })
  sortOrder?: 'ASC' | 'DESC';
}

export class ListTradesResponse {
  @ApiProperty({
    description: 'Lista de trades',
    type: [TradeDto],
  })
  data: TradeDto[];

  @ApiProperty({
    example: 1,
    description: 'Página atual',
  })
  page: number;

  @ApiProperty({
    example: 50,
    description: 'Quantidade de registros por página',
  })
  limit: number;

  @ApiProperty({
    example: 30,
    description: 'Total de registros',
  })
  total: number;

  @ApiProperty({
    example: 1,
    description: 'Total de páginas',
  })
  pages: number;

  @ApiProperty({
    example: true,
    description: 'Se há próxima página',
  })
  hasNextPage: boolean;

  @ApiProperty({
    example: false,
    description: 'Se há página anterior',
  })
  hasPrevPage: boolean;
}

export class TradeStatsDto {
  @ApiProperty({
    example: 'BTCUSDT',
    description: 'Símbolo',
  })
  symbol: string;

  @ApiProperty({
    example: 150,
    description: 'Total de trades',
  })
  totalTrades: number;

  @ApiProperty({
    example: 75,
    description: 'Total de compras',
  })
  totalBuys: number;

  @ApiProperty({
    example: 75,
    description: 'Total de vendas',
  })
  totalSells: number;

  @ApiProperty({
    example: '0.50000000',
    description: 'Comissão total paga',
  })
  totalCommission: string;

  @ApiProperty({
    example: '2024-01-15',
    description: 'Primeira trade registrada',
    format: 'date-time',
  })
  firstTradeDate: Date;

  @ApiProperty({
    example: '2025-11-17',
    description: 'Última trade registrada',
    format: 'date-time',
  })
  lastTradeDate: Date;
}

export class AllTradesSyncResponse {
  @ApiProperty({
    example: 'completed',
    description: 'Status da sincronização',
  })
  status: string;

  @ApiProperty({
    example: 1200,
    description: 'Total de símbolos USDT disponíveis sincronizados',
  })
  totalSymbols: number;

  @ApiProperty({
    example: 1180,
    description: 'Total de sincronizações bem-sucedidas',
  })
  successfulSyncs: number;

  @ApiProperty({
    example: 20,
    description: 'Total de sincronizações com falha',
  })
  failedSyncs: number;

  @ApiProperty({
    example: 50000,
    description: 'Total de trades sincronizadas nesta execução',
  })
  totalTradesSynced: number;

  @ApiProperty({
    example: 250000,
    description: 'Total de trades no banco para todos os símbolos',
  })
  totalTradesInDatabase: number;

  @ApiProperty({
    type: [SyncTradesResponse],
    description: 'Resultado detalhado por símbolo',
  })
  symbols: SyncTradesResponse[];

  @ApiProperty({
    example:
      'Sincronização completa finalizada. 1180/1200 símbolos sincronizados com sucesso.',
    description: 'Mensagem descritiva do resultado',
  })
  message: string;
}

export class WalletTradesSummaryDto {
  @ApiProperty({
    example: 250000,
    description: 'Total de trades em toda a carteira',
  })
  totalTrades: number;

  @ApiProperty({
    example: 1200,
    description: 'Total de símbolos USDT diferentes negociados',
  })
  totalSymbols: number;

  @ApiProperty({
    example: 125000,
    description: 'Total de transações de compra',
  })
  totalBuys: number;

  @ApiProperty({
    example: 125000,
    description: 'Total de transações de venda',
  })
  totalSells: number;

  @ApiProperty({
    example: '250.50000000',
    description: 'Comissão total paga em toda a carteira',
  })
  totalCommissionPaid: string;

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Data da primeira trade registrada',
    format: 'date-time',
  })
  firstTradeDate: Date;

  @ApiProperty({
    example: '2025-11-17T23:30:00.000Z',
    description: 'Data da última trade registrada',
    format: 'date-time',
  })
  lastTradeDate: Date;

  @ApiProperty({
    type: [Object],
    description: 'Resumo de trades por símbolo',
    example: [
      {
        symbol: 'BTCUSDT',
        tradeCount: 150,
        totalCommission: '2.50000000',
      },
      {
        symbol: 'ETHUSDT',
        tradeCount: 200,
        totalCommission: '3.50000000',
      },
    ],
  })
  symbols: Array<{
    symbol: string;
    tradeCount: number;
    totalCommission: string;
  }>;
}
