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
import { WsServerService } from './ws-server.service';
import KlineSubscriptionDto from './dto/klineSubscription.dto';

@WebSocketGateway({ cors: { origin: '*' } })
export class WsServerGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger: Logger = new Logger(WsServerGateway.name);

  constructor(private readonly wsServerService: WsServerService) {}

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
  handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: KlineSubscriptionDto | string,
  ) {
    this.wsServerService.handleKlineSubscription(client, data);
  }
}
