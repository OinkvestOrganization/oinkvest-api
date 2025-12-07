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
      // Conectado ao WebSocket
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data as string);

      if (message.k) {
        const streamName = `${message.s.toLowerCase()}@kline_${message.k.i}`;
        this.eventEmitter.emit(`binance.stream.${streamName}`, {
          stream: streamName,
          data: message,
        });
      }
    };

    this.ws.onclose = () => {
      // Attempt to reconnect after a delay
      setTimeout(() => this.connect(), 1000);
    };

    this.ws.onerror = () => {
      // Erro na conexão
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
        }
      }
    } catch {
      // Ignorar erros ao inscrever
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
        }
      }
    } catch {
      // Ignorar erros ao desinscrever
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
