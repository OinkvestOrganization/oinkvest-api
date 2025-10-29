import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { WebSocket } from 'ws';

@Injectable()
export class KlineHistoryService {
  private logger = new Logger(KlineHistoryService.name);
  private readonly wsRestBinance = 'wss://ws-api.binance.com:9443/ws-api/v3';
  private ws: WebSocket | null = null;
  private pendingRequests = new Map<string, (value: any) => void>();

  constructor() {
    this.connect();
  }

  private connect() {
    this.ws = new WebSocket(this.wsRestBinance);

    this.ws.on('open', () => {
      this.logger.log('Conexão com Binance WebSocket API aberta');
    });

    this.ws.on('message', (data: Buffer) => {
      const message = JSON.parse(data.toString());
      const resolve = this.pendingRequests.get(message.id);

      if (resolve) {
        resolve(message.result);
        this.pendingRequests.delete(message.id);
      } else {
        this.logger.debug('Binance WebSocket API message:', message);
      }
    });

    this.ws.on('error', (error) => {
      this.logger.error('Binance WebSocket error:', error);
    });
  }

  async getHistory(symbol: string, interval: string, limit = 1): Promise<any> {
    this.logger.debug(
      `Buscando histórico de klines para ${symbol} com intervalo ${interval} e limite ${limit}`,
    );
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const requestId = randomUUID();
        this.pendingRequests.set(requestId, resolve);

        this.ws.send(
          JSON.stringify({
            id: requestId,
            method: 'klines',
            params: {
              symbol: symbol,
              interval: interval,
              limit: limit,
            },
          }),
        );
        // Timeout para rejeitar a promessa se não houver resposta
        setTimeout(() => {
          if (this.pendingRequests.has(requestId)) {
            this.pendingRequests.delete(requestId);
            reject(new Error('Request timed out'));
          }
        }, 10000); // 10 segundos de timeout
      } else {
        reject(new Error('WebSocket connection not open'));
      }
    });
  }
}
