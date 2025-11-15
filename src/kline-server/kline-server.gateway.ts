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
import { AsyncApiOperation, AsyncApiPub, AsyncApiSub } from 'nestjs-asyncapi';
import { KlineDto } from './dto/kline.dto';

@WebSocketGateway({ cors: { origin: process.env.CORS_ORIGIN } })
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
    summary: 'Canal de inscrição de klines',
    description:
      'Se inscreve no canal "klines" para receber o histórico e atualizações de klines.',
  })
  @AsyncApiPub({
    channel: 'klines',
    message: { payload: KlineDto, name: 'Atualização de vela' },
    summary: 'Retorno de velas',
    description:
      'Resposta vinda do servidor contendo velas para popular o gráfico. O primeiro retorno é uma lista de KlineDto com o histórico de velas. Os retornos seguintes são objetos KlineDto únicos com a atualização em tempo real.',
  })
  @SubscribeMessage('klines')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: KlineSubscriptionDto,
  ) {
    await this.wsServerService.handleKlineSubscription(client, data);
  }

  @AsyncApiOperation({
    type: 'sub',
    channel: 'unsubscribe-klines',
    message: { payload: KlineSubscriptionDto },
    summary: 'Remoção de inscrição',
    description: 'Se desinscreve do canal de klines',
  })
  @SubscribeMessage('unsubscribe-klines')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: KlineSubscriptionDto,
  ) {
    this.wsServerService.handleKlineUnsubscription(client, data);
  }
}
