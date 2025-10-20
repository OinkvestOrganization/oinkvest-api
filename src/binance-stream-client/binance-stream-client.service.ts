import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WebSocket } from 'ws';
import { StreamStatusOutput } from './dto/stream-status-output.dto';

@Injectable()
export class BinanceStreamClientService implements OnModuleInit {
  private logger = new Logger(BinanceStreamClientService.name);
  private readonly binanceWsUrl = 'wss://stream.binance.com:9443/ws';
  private ws: WebSocket | null = null;
  private streamPool: Set<string> = new Set();

  constructor(private eventEmitter: EventEmitter2) {}

  onModuleInit() {
    this.connect();
  }

  private connect() {
    this.ws = new WebSocket(this.binanceWsUrl);

    this.ws.onopen = () => {
      this.logger.log('Conectado ao Binance WebSocket Stream');
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data as string);

      if (message.k) {
        const streamName = `${message.s.toLowerCase()}@kline_${message.k.i}`;
        const wasSent = this.eventEmitter.emit(`binance.stream.${streamName}`, {
          stream: streamName,
          data: message.k,
        });
        if (!wasSent) {
          this.logger.warn(`Nenhum listener para o evento ${streamName}`);
        }
      }
    };

    this.ws.onclose = () => {
      this.logger.log('Desconectado do Binance WebSocket');
      // Attempt to reconnect after a delay
      setTimeout(() => this.connect(), 1000);
    };

    this.ws.onerror = (error) => {
      this.logger.error('Binance WebSocket error:', error);
    };
  }

  subscribeToStream(streamName: string) {
    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        if (!this.streamPool.has(streamName)) {
          this.ws.send(
            JSON.stringify({
              method: 'SUBSCRIBE',
              params: [streamName],
              id: 1,
            }),
          );
          this.streamPool.add(streamName);
          this.logger.log(`Inscrito no stream: ${streamName}`);
        } else {
          this.logger.log(`Já inscrito no stream: ${streamName}`);
        }
      }
    } catch (e: any) {
      this.logger.error(e.message);
    }
  }

  unsubscribeFromStream(streamName: string) {
    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        if (this.streamPool.has(streamName)) {
          this.ws.send(
            JSON.stringify({
              method: 'UNSUBSCRIBE',
              params: [streamName],
              id: 1,
            }),
          );
          this.streamPool.delete(streamName);
          this.logger.log(`Removendo inscrição do stream : ${streamName}`);
        } else {
          this.logger.log(`Stream não encontrada: ${streamName}`);
        }
      }
    } catch (e: any) {
      this.logger.error(e.message);
    }
  }

  streamClientStatus(): StreamStatusOutput {
    const streams: Record<string, string> = {};
    for (const stream of this.streamPool) {
      streams[stream] = 'subscribed';
    }
    return {
      streamPool: streams,
    };
  }
}
