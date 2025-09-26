import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import WebSocket from 'ws';
import { WsServerService } from '@/ws-server/ws-server.service';

@Injectable()
export class BinanceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BinanceService.name);
  private ws: WebSocket | null = null;
  private readonly baseWsUrl = 'wss://stream.binance.com:9443/ws';
  private isConnected = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  private streamCallbacks: Map<string, (data: any) => void> = new Map();

  constructor(
    @Inject(forwardRef(() => WsServerService))
    private readonly wsServerService: WsServerService,
  ) {}

  onModuleInit() {
    this.logger.log('Inicializando serviço da Binance...');
  }

  onModuleDestroy() {
    this.closeConnection();
  }

  private connect(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.isConnected && this.ws) {
        this.logger.log('Já conectado ao WebSocket da Binance');
        resolve(true);
        return;
      }

      this.logger.log('Conectando ao WebSocket da Binance...');
      this.ws = new WebSocket(this.baseWsUrl);

      this.ws.on('open', () => {
        this.logger.log('Conexão WebSocket estabddelecida com sucesso');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        resolve(true);
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const parsedData = JSON.parse(data.valueOf() as string);

          if (parsedData.result === null && parsedData.id) {
            this.logger.log(`Subscrição confirmada para ID: ${parsedData.id}`);
            return;
          }

          if (
            parsedData.stream &&
            this.streamCallbacks.has(parsedData.stream)
          ) {
            const callback = this.streamCallbacks.get(parsedData.stream);
            if (callback) {
              callback(parsedData.data);
            }
            this.wsServerService.broadcastKlines(parsedData);
          } else if (parsedData.e === 'kline') {
            const streamId = `${parsedData.s.toLowerCase()}@kline_${parsedData.k.i}`;
            if (this.streamCallbacks.has(streamId)) {
              const callback = this.streamCallbacks.get(streamId);
              if (callback) {
                callback(parsedData);
              }
              this.wsServerService.broadcastKlines({
                stream: streamId,
                data: parsedData,
              });
            }
          }
        } catch (error) {
          this.logger.error(`Erro ao processar mensagem: ${error.message}`);
        }
      });

      this.ws.on('error', (error) => {
        this.logger.error(`Erro na conexão WebSocket: ${error.message}`);
        this.isConnected = false;
        resolve(false);
      });

      this.ws.on('close', () => {
        this.logger.warn('Conexão WebSocket fechada');
        this.isConnected = false;

        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = Math.pow(2, this.reconnectAttempts) * 1000;
          this.logger.log(
            `Tentando reconectar em ${delay}ms (tentativa ${this.reconnectAttempts})`,
          );

          this.reconnectTimeout = setTimeout(() => {
            void this.connect().then(async (success) => {
              if (success) {
                await this.resubscribeToStreams();
              }
            });
          }, delay);
        } else {
          this.logger.error(
            `Falha ao reconectar após ${this.maxReconnectAttempts} tentativas`,
          );
        }
      });
    });
  }

  private closeConnection() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.terminate();
      this.ws = null;
      this.isConnected = false;
      this.logger.log('Conexão WebSocket fechada');
    }
  }

  private async resubscribeToStreams() {
    if (!this.isConnected || !this.ws) {
      await this.connect();
    }

    const streams = Array.from(this.streamCallbacks.keys());
    if (streams.length > 0) {
      this.logger.log(`Resubscrevendo em ${streams.length} streams...`);

      if (streams.length > 1) {
        const subscriptionMessage = {
          method: 'SUBSCRIBE',
          params: streams,
          id: Date.now(),
        };

        if (this.ws) {
          this.ws.send(JSON.stringify(subscriptionMessage));
        }
      } else {
        this.ws?.send(
          JSON.stringify({
            method: 'SUBSCRIBE',
            params: [streams[0]],
            id: Date.now(),
          }),
        );
      }
    }
  }

  async subscribeToStream(
    streamName: string,
    callback: (data: any) => void,
  ): Promise<boolean> {
    if (!this.isConnected || !this.ws) {
      const connected = await this.connect();
      if (!connected) {
        return false;
      }
    }

    this.streamCallbacks.set(streamName, callback);

    const subscriptionMessage = {
      method: 'SUBSCRIBE',
      params: [streamName],
      id: Date.now(),
    };

    if (this.ws) {
      this.ws.send(JSON.stringify(subscriptionMessage));
    }
    this.logger.log(`Subscrito no stream: ${streamName}`);
    return true;
  }

  unsubscribeFromStream(streamName: string): boolean {
    if (!this.isConnected || !this.ws) {
      this.logger.warn('Não é possível cancelar subscrição: não conectado');
      return false;
    }

    if (!this.streamCallbacks.has(streamName)) {
      this.logger.warn(`Stream ${streamName} não está subscrito`);
      return false;
    }

    const unsubscriptionMessage = {
      method: 'UNSUBSCRIBE',
      params: [streamName],
      id: Date.now(),
    };

    this.ws.send(JSON.stringify(unsubscriptionMessage));
    this.streamCallbacks.delete(streamName);
    this.logger.log(`Subscrição cancelada para: ${streamName}`);
    return true;
  }

  async subscribeTicker(
    symbol: string,
    callback: (data: any) => void,
  ): Promise<boolean> {
    const streamName = `${symbol.toLowerCase()}@ticker`;
    return this.subscribeToStream(streamName, callback);
  }

  async subscribeTrades(
    symbol: string,
    callback: (data: any) => void,
  ): Promise<boolean> {
    const streamName = `${symbol.toLowerCase()}@trade`;
    return this.subscribeToStream(streamName, callback);
  }

  async subscribeOrderBook(
    symbol: string,
    levels: 5 | 10 | 20,
    callback: (data: any) => void,
  ): Promise<boolean> {
    const streamName = `${symbol.toLowerCase()}@depth${levels}`;
    return this.subscribeToStream(streamName, callback);
  }

  async subscribeKlines(
    symbol: string,
    interval:
      | '1m'
      | '5m'
      | '15m'
      | '30m'
      | '1h'
      | '2h'
      | '4h'
      | '6h'
      | '8h'
      | '12h'
      | '1d'
      | '3d'
      | '1w'
      | '1M',
    callback: (data: any) => void,
  ): Promise<boolean> {
    const streamName = `${symbol.toLowerCase()}@kline_${interval}`;
    return this.subscribeToStream(streamName, callback);
  }
}
