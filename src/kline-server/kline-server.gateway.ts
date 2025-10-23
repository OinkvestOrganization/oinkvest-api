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
import { KlineServerService } from './kline-server.service';
import KlineSubscriptionDto from './dto/klineSubscription.dto';

@WebSocketGateway({ cors: { origin: '*' } })
export class KlineServerGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger: Logger = new Logger(KlineServerGateway.name);

  constructor(private readonly wsServerService: KlineServerService) {}

  afterInit(server: Server) {
    this.wsServerService.setServer(server);
    this.logger.log('WebSocket server initialized and passed to service');
  }

  handleConnection(client: Socket) {
    this.wsServerService.registerClient(client);
  }

  handleDisconnect(client: Socket) {
    this.wsServerService.deregisterClient(client);
  }

  @SubscribeMessage('klines')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: KlineSubscriptionDto,
  ) {
    await this.wsServerService.handleKlineSubscription(client, data);
  }

  @SubscribeMessage('unsubscribe-klines')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: KlineSubscriptionDto,
  ) {
    this.wsServerService.handleKlineUnsubscription(client, data);
  }
}
