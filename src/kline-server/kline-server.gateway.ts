import { Header, Logger } from '@nestjs/common';
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
import { AsyncApiOperation, AsyncApiPub, AsyncApiSub } from 'nestjs-asyncapi';
import { KlineDto } from './dto/kline.dto';

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

  
  @AsyncApiSub({
    channel: 'klines',
    message: { payload: KlineSubscriptionDto },
    description: 'Se inscreve no canal "klines" para receber o histórico e atualizações de klines.'
  })
  @AsyncApiPub({
    channel: 'klines',
    message: { payload: KlineDto },
  })
  @SubscribeMessage('klines')
  handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: KlineSubscriptionDto,
  ) {
    this.wsServerService.handleKlineSubscription(client, data);
  }

  // @AsyncApiSub({
  //   channel: 'unsubscribe-klines',
  //   message: { payload: KlineDto},
  //   description: 'Se inscreve no canal "klines" para receber o histórico e atualizações de klines.'
  // })
  @AsyncApiOperation({
    type: 'sub',
    channel: 'unsubscribe-klines',
    message: { payload: KlineSubscriptionDto },
    description: 'Se desinscreve do canal de klines'
  })
  @SubscribeMessage('unsubscribe-klines')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: KlineSubscriptionDto,
  ) {
    this.wsServerService.handleKlineUnsubscription(client, data);
  }
}
