import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import KlineSubscriptionDto from './dto/klineSubscription.dto';
import { WsServerService } from './ws-server.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class WsServerGateway
  implements OnGatewayConnection, OnGatewayInit, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger: Logger = new Logger(WsServerGateway.name);

  private clientSubscriptions: Map<string, Set<string>> = new Map();

  constructor(private readonly wsServerService: WsServerService) {}

  afterInit() {
    this.logger.log('WebSocket server initialized');
  }

  handleConnection(client: any) {
    this.logger.log(`Client connected: ${client.id}`);
    this.clientSubscriptions.set(client.id, new Set());
  }

  handleDisconnect(client: any) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.clientSubscriptions.delete(client.id);
  }

  @OnEvent('klines')
  handleKlinesEvent(payload: {
    symbol: string;
    interval: string;
    data: string;
  }) {
    this.logger.log(
      `Klines event received: ${payload.symbol}, ${payload.interval}, ${payload.data}`,
    );
    const { symbol, interval, data } = payload;
    this.server.emit('klines', { symbol, interval, data });
  }

  @SubscribeMessage('klines')
  handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: KlineSubscriptionDto,
  ) {
    const { symbol, interval } = JSON.parse(JSON.stringify(data));
    this.logger.log(
      `Client ${client.id} subscribed to ${symbol} at ${interval}`,
    );
    const clientSubs = this.clientSubscriptions.get(client.id);
    if (clientSubs) {
      clientSubs.add(`${symbol}-${interval}`);
    }
    this.wsServerService.subcribeToKlines(client.id, symbol, interval);
    return { event: 'klines', data: `Subscribed to ${symbol} at ${interval}` };
  }
}
