import { Controller, Get, Param, Query, Sse, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { BinanceService } from './binance.service';
import { Observable, Subject, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Controller('binance')
export class BinanceController {
  private readonly logger = new Logger(BinanceController.name);
  
  constructor(private readonly binanceService: BinanceService) {}

  /**
   * Endpoint SSE para receber dados de ticker em tempo real
   * @param symbol Par de moedas (ex: 'btcusdt')
   */
  @Sse('ticker/:symbol')
  async streamTicker(@Param('symbol') symbol: string): Promise<Observable<MessageEvent>> {
    const subject = new Subject<any>();
    
    try {
      // Enviar dados iniciais para confirmar que a conexão está funcionando
      subject.next({ data: { message: 'Conectado ao stream de ticker' } });
      
      const success = await this.binanceService.subscribeTicker(symbol, (data) => {
        // Formatando corretamente o objeto MessageEvent para SSE
        subject.next({ 
          data: { 
            symbol: symbol,
            price: data.p || data.price || "Aguardando dados...",
            time: new Date().toISOString(),
            raw: data
          } 
        });
      });
      
      if (!success) {
        this.logger.error(`Falha ao subscrever no ticker para ${symbol}`);
        subject.error(new HttpException('Falha ao conectar com a API da Binance', HttpStatus.SERVICE_UNAVAILABLE));
      }
    } catch (error) {
      this.logger.error(`Erro ao subscrever no ticker para ${symbol}: ${error.message}`);
      subject.error(new HttpException('Erro ao processar a requisição', HttpStatus.INTERNAL_SERVER_ERROR));
    }
    
    return subject.asObservable();
  }

  /**
   * Endpoint SSE para receber dados de negociações em tempo real
   * @param symbol Par de moedas (ex: 'btcusdt')
   */
  @Sse('trades/:symbol')
  async streamTrades(@Param('symbol') symbol: string): Promise<Observable<MessageEvent>> {
    const subject = new Subject<any>();
    
    try {
      const success = await this.binanceService.subscribeTrades(symbol, (data) => {
        subject.next({
          data: JSON.stringify(data),
          type: 'trade',
          id: Date.now().toString(),
          lastEventId: '',
        });
      });
      
      if (!success) {
        this.logger.error(`Falha ao subscrever em trades para ${symbol}`);
        subject.error(new HttpException('Falha ao conectar com a API da Binance', HttpStatus.SERVICE_UNAVAILABLE));
      }
    } catch (error) {
      this.logger.error(`Erro ao subscrever em trades para ${symbol}: ${error.message}`);
      subject.error(new HttpException('Erro ao processar a requisição', HttpStatus.INTERNAL_SERVER_ERROR));
    }
    
    return subject.asObservable();
  }

  /**
   * Endpoint SSE para receber dados de book de ofertas em tempo real
   * @param symbol Par de moedas (ex: 'btcusdt')
   * @param levels Número de níveis (5, 10 ou 20)
   */
  @Sse('orderbook/:symbol')
  async streamOrderBook(
    @Param('symbol') symbol: string,
    @Query('levels') levels: string = '10',
  ): Promise<Observable<MessageEvent>> {
    const subject = new Subject<any>();
    
    try {
      const validLevels = parseInt(levels) as 5 | 10 | 20;
      
      // Validação dos níveis
      const orderBookLevels = [5, 10, 20].includes(validLevels) ? validLevels : 10;
      
      const success = await this.binanceService.subscribeOrderBook(symbol, orderBookLevels, (data) => {
        subject.next({
          data: JSON.stringify(data),
          type: 'orderbook',
          id: Date.now().toString(),
          lastEventId: '',
        });
      });
      
      if (!success) {
        this.logger.error(`Falha ao subscrever no orderbook para ${symbol}`);
        subject.error(new HttpException('Falha ao conectar com a API da Binance', HttpStatus.SERVICE_UNAVAILABLE));
      }
    } catch (error) {
      this.logger.error(`Erro ao subscrever no orderbook para ${symbol}: ${error.message}`);
      subject.error(new HttpException('Erro ao processar a requisição', HttpStatus.INTERNAL_SERVER_ERROR));
    }
    
    return subject.asObservable();
  }

  /**
   * Endpoint SSE para receber dados de candles (velas) em tempo real
   * @param symbol Par de moedas (ex: 'btcusdt')
   * @param interval Intervalo de tempo (1m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 1w, 1M)
   */
  @Sse('klines/:symbol')
  async streamKlines(
    @Param('symbol') symbol: string,
    @Query('interval') interval: string = '1m',
  ): Promise<Observable<MessageEvent>> {
    const subject = new Subject<any>();
    
    try {
      // Validação do intervalo
      const validIntervals = ['1m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'];
      const klineInterval = validIntervals.includes(interval) 
        ? interval as '1m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '6h' | '8h' | '12h' | '1d' | '3d' | '1w' | '1M'
        : '1m';
      
      // Enviar dados iniciais para confirmar que a conexão está funcionando
      subject.next({ data: { message: `Conectado ao stream de klines para ${symbol} com intervalo ${klineInterval}` } });
      
      const success = await this.binanceService.subscribeKlines(symbol, klineInterval, (data) => {
        // Formatando corretamente o objeto MessageEvent para SSE
        subject.next({ 
          data: { 
            symbol: symbol,
            interval: klineInterval,
            open: data.o || data.open || "Aguardando dados...",
            high: data.h || data.high || "Aguardando dados...",
            low: data.l || data.low || "Aguardando dados...",
            close: data.c || data.close || "Aguardando dados...",
            volume: data.v || data.volume || "Aguardando dados...",
            time: new Date().toISOString(),
            raw: data
          } 
        });
      });
      
      if (!success) {
        this.logger.error(`Falha ao subscrever em klines para ${symbol}`);
        subject.error(new HttpException('Falha ao conectar com a API da Binance', HttpStatus.SERVICE_UNAVAILABLE));
      }
    } catch (error) {
      this.logger.error(`Erro ao subscrever em klines para ${symbol}: ${error.message}`);
      subject.error(new HttpException('Erro ao processar a requisição', HttpStatus.INTERNAL_SERVER_ERROR));
    }
    
    return subject.asObservable();
  }
}