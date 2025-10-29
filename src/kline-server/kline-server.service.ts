import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import { BinanceStreamClientService } from '../binance-stream-client/binance-stream-client.service';
import KlineSubscriptionDto from './dto/klineSubscription.dto';
import { KlineHistoryService } from './kline-history.service';
import { KlineDto } from './dto/kline.dto';
import { KlineStatusDto } from './dto/kline-status.dto';

@Injectable()
export class KlineServerService {
  private readonly logger = new Logger(KlineServerService.name);
  private server: Server;

  // Map<streamName, Set<clientId>>
  private streamSubscribers = new Map<string, Set<string>>();

  constructor(
    private readonly binanceStreamClient: BinanceStreamClientService,
    private readonly klineHistoryServer: KlineHistoryService,
  ) {}

  setServer(server: Server) {
    this.server = server;
  }

  registerClient(client: Socket) {
    this.logger.log(`Client conectado: ${client.id}`);
  }

  deregisterClient(client: Socket) {
    this.logger.log(`Client desconectado: ${client.id}`);
    this.unsubscribeClientFromAllStreams(client.id);
  }

  async handleKlineSubscription(client: Socket, data: KlineSubscriptionDto) {
    const payload = this.parseData(client, data);
    if (!payload) return;

    const streamName = this.getStreamName(payload.symbol, payload.interval);
    this.logger.log(`Client ${client.id} inscrito em: ${streamName}`);

    if (!this.streamSubscribers.has(streamName)) {
      this.streamSubscribers.set(streamName, new Set());
      // First subscriber for this stream, subscribe to Binance
      this.binanceStreamClient.subscribeToStream(streamName);
    }
    this.streamSubscribers.get(streamName)?.add(client.id);
    // const history = await this.klineHistoryServer.getHistory(
    //   data.symbol,
    //   data.interval,
    //   data.limit,
    // );

    // if (Array.isArray(history)) {
    //   const historyDtos = history.map((kline) =>
    //     KlineDto.fromHistory(kline, data.symbol, data.interval),
    //   );
    //   client.emit('klines', historyDtos);
    // } else {
    //   client.emit('klines', history);
    // }
  }

  handleKlineUnsubscription(client: Socket, data: KlineSubscriptionDto) {
    const payload = this.parseData(client, data);
    if (!payload) return;

    const streamName = this.getStreamName(payload.symbol, payload.interval);
    this.unsubscribe(streamName, client.id);

    client.emit('klines', `Inscrição removida do stream: ${streamName}`);
  }

  private unsubscribe(streamName: string, clientId: string) {
    const subscribers = this.streamSubscribers.get(streamName);
    if (!subscribers?.has(clientId)) return;

    subscribers.delete(clientId);
    this.logger.log(`Client ${clientId} desinscrito do stream: ${streamName}`);

    if (subscribers.size === 0) {
      // Last subscriber left, unsubscribe from Binance
      this.streamSubscribers.delete(streamName);
      this.binanceStreamClient.unsubscribeFromStream(streamName);
      this.logger.log(
        `Removendo inscrição do stream ${streamName} do Binance Stream Client como não há mais clientes.`,
      );
    }
  }

  private unsubscribeClientFromAllStreams(clientId: string) {
    for (const streamName of this.streamSubscribers.keys()) {
      this.unsubscribe(streamName, clientId);
    }
  }

  @OnEvent('binance.stream.**')
  handleBinanceStream(payload: { stream: string; data: any }) {
    const { stream, data } = payload;

    const subscribers = this.streamSubscribers.get(stream);
    if (subscribers) {
      subscribers.forEach((clientId) => {
        // const klineDto = KlineDto.fromBinance(data);
        this.server.to(clientId).emit('klines', data);
      });
    }
  }

  private getStreamName(symbol: string, interval: string): string {
    return `${symbol.toLowerCase()}@kline_${interval}`;
  }

  private parseData(
    client: Socket,
    data: KlineSubscriptionDto | string,
  ): KlineSubscriptionDto | null {
    if (typeof data === 'string') {
      try {
        return JSON.parse(data) as KlineSubscriptionDto;
      } catch (e: any) {
        this.logger.error('Invalid JSON for subscription', data, e);
        client.emit('error', 'Invalid data format');
        return null;
      }
    }
    return data;
  }

  public getConnectionsStatus(): KlineStatusDto {
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
