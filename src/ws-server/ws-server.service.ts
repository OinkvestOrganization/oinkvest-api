import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WebSocket } from 'ws';
import KlineSubscriptionDto from './dto/klineSubscription.dto';
import { BinanceService } from '@/binance/binance.service';

@Injectable()
export class WsServerService {
  private readonly logger = new Logger(WsServerService.name);

  private server: Server;
  // Map<streamId, Set<clientId>>
  private streamSubscribers = new Map<string, Set<string>>();
  // Map<streamId, WebSocket>
  private externalSockets = new Map<string, WebSocket>();

  constructor(private readonly binanceService: BinanceService) {}

  setServer(server: Server) {
    this.server = server;
  }

  registerClient(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  deregisterClient(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.unsubscribeFromAll(client.id);
  }

  handleKlineSubscription(client: Socket, data: KlineSubscriptionDto | string) {
    let payload: KlineSubscriptionDto;
    if (typeof data === 'string') {
      try {
        payload = JSON.parse(data) as KlineSubscriptionDto;
      } catch (e) {
        this.logger.error(
          'Invalid JSON received for klines subscription',
          data,
        );
        client.emit('error', 'Invalid data format');
        return;
      }
    } else {
      payload = data;
    }

    this.logger.log(
      `Client ${client.id} subscribed to ${payload.symbol} at ${payload.interval}`,
    );
    this.subscribeToKlines(client.id, payload.symbol, payload.interval);

    client.emit(
      'klines',
      `Subscribed to ${payload.symbol} at ${payload.interval}`,
    );
  }

  handleKlineUnsubscription(
    client: Socket,
    data: KlineSubscriptionDto | string,
  ) {
    let payload: KlineSubscriptionDto;
    if (typeof data === 'string') {
      try {
        payload = JSON.parse(data) as KlineSubscriptionDto;
      } catch (e) {
        this.logger.error(
          'Invalid JSON received for klines unsubscription',
          data,
        );
        client.emit('error', 'Invalid data format');
        return;
      }
    } else {
      payload = data;
    }

    this.logger.log(
      `Client ${client.id} unsubscribed from ${payload.symbol} at ${payload.interval}`,
    );
    const streamId = this.getStreamId(payload.symbol, payload.interval);
    this.unsubscribe(streamId, client.id);

    client.emit(
      'klines',
      `Unsubscribed from ${payload.symbol} at ${payload.interval}`,
    );
  }

  subscribeToKlines(clientId: string, symbol: string, interval: string) {
    const streamId = this.getStreamId(symbol, interval);

    if (!this.streamSubscribers.has(streamId)) {
      this.streamSubscribers.set(streamId, new Set());
    }
    this.streamSubscribers.get(streamId)?.add(clientId);

    if (!this.externalSockets.has(streamId)) {
      this.createKlineSubscription(symbol, interval);
      this.logger.log(`Starting new WebSocket connection for ${streamId}`);
    }
  }

  unsubscribe(streamId: string, clientId: string) {
    const subscriptions = this.streamSubscribers.get(streamId);
    if (subscriptions?.has(clientId)) {
      subscriptions.delete(clientId);
      this.logger.log(`Client ${clientId} unsubscribed from ${streamId}`);
      this.checkEmptySubscriptions(streamId);
    }
  }

  unsubscribeFromAll(clientId: string) {
    for (const streamId of this.streamSubscribers.keys()) {
      this.unsubscribe(streamId, clientId);
    }
  }

  public broadcastKlines(payload: { stream: string; data: any }) {
    const { stream, data } = payload;
    const subscribedClientIds = this.streamSubscribers.get(stream);

    if (subscribedClientIds) {
      subscribedClientIds.forEach((clientId) => {
        this.server.to(clientId).emit('klines', { stream, data });
      });
    }
  }

  createKlineSubscription(symbol: string, interval: string) {
    const streamId = this.getStreamId(symbol, interval);
    this.binanceService.subscribeKlines(symbol, interval as any, (data) => {
      // O broadcast é feito pelo BinanceService agora
    });

    this.externalSockets.set(streamId, {
      close: () => this.binanceService.unsubscribeFromStream(streamId),
    } as any);
  }

  private checkEmptySubscriptions(streamId: string) {
    const socket = this.externalSockets.get(streamId);
    const subscribers = this.streamSubscribers.get(streamId);
    if (socket && (!subscribers || subscribers.size === 0)) {
      socket.close();
      this.externalSockets.delete(streamId);
      this.streamSubscribers.delete(streamId);
      this.logger.log(
        `WebSocket connection for ${streamId} closed due to no subscribers`,
      );
    }
  }

  private getStreamId(symbol: string, interval: string): string {
    return `${symbol.toLowerCase()}@kline_${interval}`;
  }

  public getConnectionsStatus() {
    const streams = {};
    for (const [streamId, clientIds] of this.streamSubscribers.entries()) {
      streams[streamId] = {
        subscriberCount: clientIds.size,
        subscribers: Array.from(clientIds),
      };
    }

    return {
      totalConnections: this.server?.engine.clientsCount ?? 0,
      activeStreamsCount: this.streamSubscribers.size,
      activeStreams: streams,
    };
  }
}
