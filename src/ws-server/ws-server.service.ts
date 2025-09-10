import { Injectable, Logger } from '@nestjs/common';
import EventEmitter2 from 'eventemitter2';
import { WebSocket } from 'ws';

@Injectable()
export class WsServerService {
  private readonly logger = new Logger(WsServerService.name);

  private sockets = new Map<string, WebSocket>();
  // Armazena qual cliente está inscrito em qual símbolo e intervalo
  private streamSubscribers = new Map<string, Set<string>>();

  constructor(private readonly emitter: EventEmitter2) {}

  subcribeToKlines(clientId: string, symbol: string, interval: string) {
    const streamId = this.getStreamId(symbol, interval);

    // Adiciona o cliente à lista de inscritos para o stream específico
    if (!this.streamSubscribers.has(streamId)) {
      this.streamSubscribers.set(streamId, new Set());
    }
    this.streamSubscribers.get(streamId)?.add(clientId);

    // Lógica para iniciar a conexão WebSocket com a API de dados, se ainda não estiver conectada
    if (!this.sockets.has(streamId)) {
      // TODO: Implementar a lógica de conexão WebSocket com a API de dados
      this.createKlineSubscription(symbol, interval);
      this.logger.log(`Iniciando nova conexão WebSocket para ${streamId}`);
    } else {
      this.logger.log(`Cliente ${clientId} já inscrito em ${streamId}`);
    }
  }

  unsubscribe(streamId: string, clientId: string) {
    const subscriptions = this.streamSubscribers.get(streamId);
    if (subscriptions && subscriptions.has(clientId)) {
      subscriptions.delete(clientId);
      this.logger.log(`Cliente ${clientId} desinscrito de ${streamId}`);
      this.checkEmptySubscriptions(streamId);
    }
  }

  createKlineSubscription(symbol: string, interval: string) {
    const streamId = this.getStreamId(symbol, interval);

    // Cria um intervalo que emite o evento 'klines' a cada 2 segundos
    const intervalId = setInterval(() => {
      this.emitter.emit('klines', {
        symbol,
        interval,
        data: 'Sample kline data',
      });
    }, 2000);

    // Armazena o intervalId para poder limpar depois, se necessário
    // Aqui, estamos usando o Map de sockets para armazenar o intervalId
    // (você pode ajustar para armazenar um objeto se precisar de mais informações)
    this.sockets.set(streamId, {
      close: () => clearInterval(intervalId),
    } as any);
  }

  private checkEmptySubscriptions(streamId: string) {
    const socket = this.sockets.get(streamId);
    const subscribers = this.streamSubscribers.get(streamId);
    if (socket && (!subscribers || subscribers.size === 0)) {
      socket.close();
      this.sockets.delete(streamId);
      this.streamSubscribers.delete(streamId);
      this.logger.log(
        `Conexão WebSocket para ${streamId} fechada por falta de inscritos`,
      );
    }
  }

  private getStreamId(symbol: string, interval: string): string {
    return `${symbol}@${interval}`;
  }
}
