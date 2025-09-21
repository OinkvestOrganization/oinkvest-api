import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import WebSocket from 'ws';

@Injectable()
export class BinanceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BinanceService.name);
  private ws: WebSocket | null = null;
  private readonly baseWsUrl = 'wss://stream.binance.com:9443/ws';
  private isConnected = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  // Armazena os callbacks para diferentes streams
  private streamCallbacks: Map<string, (data: any) => void> = new Map();

  onModuleInit() {
    this.logger.log('Inicializando serviço da Binance...');
  }

  onModuleDestroy() {
    this.closeConnection();
  }

  /**
   * Estabelece uma conexão WebSocket com a Binance
   */
  private connect(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.isConnected && this.ws) {
        this.logger.log('Já conectado ao WebSocket da Binance');
        resolve(true);
        return;
      }

      this.logger.log('Conectando ao WebSocket da Binance...');
      this.ws = new WebSocket(this.baseWsUrl);

      this.ws.on('open', () => {
        this.logger.log('Conexão WebSocket estabelecida com sucesso');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        resolve(true);
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const parsedData = JSON.parse(data.toString());
          
          // Verifica se é uma resposta de subscrição
          if (parsedData.result === null && parsedData.id) {
            this.logger.log(`Subscrição confirmada para ID: ${parsedData.id}`);
            return;
          }

          // Processa dados de stream
          if (parsedData.stream && this.streamCallbacks.has(parsedData.stream)) {
            const callback = this.streamCallbacks.get(parsedData.stream);
            if (callback) {
              callback(parsedData.data);
            }
          } else if (parsedData.e && !parsedData.stream) {
            // Formato alternativo para streams individuais
            const streamType = parsedData.e.toLowerCase();
            // Procura callbacks que correspondam ao tipo de evento
            for (const [stream, callback] of this.streamCallbacks.entries()) {
              if (stream.includes(streamType)) {
                callback(parsedData);
                break;
              }
            }
          }
        } catch (error) {
          this.logger.error(`Erro ao processar mensagem: ${error.message}`);
        }
      });

      this.ws.on('error', (error) => {
        this.logger.error(`Erro na conexão WebSocket: ${error.message}`);
        this.isConnected = false;
        resolve(false);
      });

      this.ws.on('close', () => {
        this.logger.warn('Conexão WebSocket fechada');
        this.isConnected = false;
        
        // Tenta reconectar
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Backoff exponencial
          this.logger.log(`Tentando reconectar em ${delay}ms (tentativa ${this.reconnectAttempts})`);
          
          this.reconnectTimeout = setTimeout(() => {
            this.connect().then((success) => {
              if (success) {
                // Resubscreve em todos os streams ativos
                this.resubscribeToStreams();
              }
            });
          }, delay);
        } else {
          this.logger.error(`Falha ao reconectar após ${this.maxReconnectAttempts} tentativas`);
        }
      });
    });
  }

  /**
   * Fecha a conexão WebSocket
   */
  private closeConnection() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.terminate();
      this.ws = null;
      this.isConnected = false;
      this.logger.log('Conexão WebSocket fechada');
    }
  }

  /**
   * Resubscreve em todos os streams ativos após reconexão
   */
  private async resubscribeToStreams() {
    if (!this.isConnected || !this.ws) {
      await this.connect();
    }

    const streams = Array.from(this.streamCallbacks.keys());
    if (streams.length > 0) {
      this.logger.log(`Resubscrevendo em ${streams.length} streams...`);
      
      // Para múltiplos streams, usamos o formato combinado
      if (streams.length > 1) {
        const subscriptionMessage = {
          method: 'SUBSCRIBE',
          params: streams,
          id: Date.now(),
        };
        
        if (this.ws) {
          this.ws.send(JSON.stringify(subscriptionMessage));
        }
      } else {
        // Para um único stream, podemos usar o formato simples
        this.ws?.send(JSON.stringify({
          method: 'SUBSCRIBE',
          params: [streams[0]],
          id: Date.now(),
        }));
      }
    }
  }

  /**
   * Subscreve em um stream de mercado específico
   * @param streamName Nome do stream (ex: 'btcusdt@trade')
   * @param callback Função a ser chamada quando dados forem recebidos
   */
  async subscribeToStream(streamName: string, callback: (data: any) => void): Promise<boolean> {
    if (!this.isConnected || !this.ws) {
      const connected = await this.connect();
      if (!connected) {
        return false;
      }
    }

    this.streamCallbacks.set(streamName, callback);
    
    const subscriptionMessage = {
      method: 'SUBSCRIBE',
      params: [streamName],
      id: Date.now(),
    };

    if (this.ws) {
      this.ws.send(JSON.stringify(subscriptionMessage));
    }
    this.logger.log(`Subscrito no stream: ${streamName}`);
    return true;
  }

  /**
   * Cancela a subscrição em um stream específico
   * @param streamName Nome do stream a cancelar
   */
  unsubscribeFromStream(streamName: string): boolean {
    if (!this.isConnected || !this.ws) {
      this.logger.warn('Não é possível cancelar subscrição: não conectado');
      return false;
    }

    if (!this.streamCallbacks.has(streamName)) {
      this.logger.warn(`Stream ${streamName} não está subscrito`);
      return false;
    }

    const unsubscriptionMessage = {
      method: 'UNSUBSCRIBE',
      params: [streamName],
      id: Date.now(),
    };

    this.ws.send(JSON.stringify(unsubscriptionMessage));
    this.streamCallbacks.delete(streamName);
    this.logger.log(`Subscrição cancelada para: ${streamName}`);
    return true;
  }

  /**
   * Obtém dados de ticker para um par de moedas
   * @param symbol Par de moedas (ex: 'btcusdt')
   */
  async subscribeTicker(symbol: string, callback: (data: any) => void): Promise<boolean> {
    const streamName = `${symbol.toLowerCase()}@ticker`;
    return this.subscribeToStream(streamName, callback);
  }

  /**
   * Obtém dados de negociações para um par de moedas
   * @param symbol Par de moedas (ex: 'btcusdt')
   */
  async subscribeTrades(symbol: string, callback: (data: any) => void): Promise<boolean> {
    const streamName = `${symbol.toLowerCase()}@trade`;
    return this.subscribeToStream(streamName, callback);
  }

  /**
   * Obtém dados de book de ofertas para um par de moedas
   * @param symbol Par de moedas (ex: 'btcusdt')
   * @param levels Número de níveis (5, 10 ou 20)
   */
  async subscribeOrderBook(symbol: string, levels: 5 | 10 | 20, callback: (data: any) => void): Promise<boolean> {
    const streamName = `${symbol.toLowerCase()}@depth${levels}`;
    return this.subscribeToStream(streamName, callback);
  }

  /**
   * Obtém dados de candles (velas) para um par de moedas
   * @param symbol Par de moedas (ex: 'btcusdt')
   * @param interval Intervalo de tempo (1m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 1w, 1M)
   */
  async subscribeKlines(
    symbol: string, 
    interval: '1m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '6h' | '8h' | '12h' | '1d' | '3d' | '1w' | '1M',
    callback: (data: any) => void
  ): Promise<boolean> {
    const streamName = `${symbol.toLowerCase()}@kline_${interval}`;
    return this.subscribeToStream(streamName, callback);
  }
}