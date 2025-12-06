import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import * as crypto from 'crypto';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

@Injectable()
export class BinanceRestClientService {
  private readonly logger = new Logger(BinanceRestClientService.name);
  private readonly baseUrl =
    process.env.BINANCE_API_URL || 'https://api.binance.com';
  private readonly defaultRecvWindow =
    (process.env.BINANCE_RECV_WINDOW &&
      parseInt(process.env.BINANCE_RECV_WINDOW, 10)) ||
    5000;

  // diferença entre o relógio local e o da Binance (server - local)
  private timeOffsetMs = Number.NaN; // NaN indica "ainda não sincronizado"

  constructor(private readonly http: HttpService) {}

  // ===== Helpers =====
  private sign(query: string, apiSecret: string): string {
    return crypto.createHmac('sha256', apiSecret).update(query).digest('hex');
  }

  private nowWithOffset(): number {
    // se ainda não sincronizamos, use Date.now() sem offset
    return Number.isFinite(this.timeOffsetMs)
      ? Date.now() + this.timeOffsetMs
      : Date.now();
  }

  private buildSignedQuery(
    params: Record<string, any>,
    apiSecret: string,
  ): string {
    const query = new URLSearchParams({
      ...params,
      timestamp: this.nowWithOffset().toString(),
      recvWindow: String(this.defaultRecvWindow),
    }).toString();

    const signature = this.sign(query, apiSecret);
    return `${query}&signature=${signature}`;
  }

  private extractErrInfo(err: unknown): { code: number; msg: string } {
    const error = err as AxiosError;
    const code = error?.response?.status ?? 500;

    let msg = 'Unknown error';
    const data: any = error?.response?.data;
    if (data) {
      if (typeof data === 'string') msg = data;
      else if (typeof data?.msg === 'string') msg = data.msg;
      else if (typeof data?.message === 'string') msg = data.message;
    } else if (typeof error?.message === 'string') {
      msg = error.message;
    }

    return { code, msg };
  }

  // ===== Time Sync =====
  private async syncServerTime(): Promise<void> {
    try {
      const url = `${this.baseUrl}/api/v3/time`;
      const { data } = await firstValueFrom(
        this.http.get<{ serverTime: number }>(url, { timeout: 5000 }),
      );
      const server = data.serverTime;
      const local = Date.now();
      this.timeOffsetMs = server - local; // se positivo, server está à frente
      this.logger.log(`Binance time offset ajustado: ${this.timeOffsetMs}ms`);
    } catch (e) {
      // Não falhe duro na sync inicial de tempo; apenas logue
      const { code, msg } = this.extractErrInfo(e);
      this.logger.warn(
        `Falha ao sincronizar tempo com Binance [${code}]: ${msg}`,
      );
      // mantém NaN => buildSignedQuery usará Date.now()
    }
  }

  // ===== HTTP SIGNED =====
  async signedGet<T>(
    path: string,
    apiKey: string,
    apiSecret: string,
    params: Record<string, any> = {},
  ): Promise<T> {
    // Garante offset antes da primeira chamada assinada
    if (!Number.isFinite(this.timeOffsetMs)) {
      await this.syncServerTime();
    }

    const attempt = async () => {
      const query = this.buildSignedQuery(params, apiSecret);
      const url = `${this.baseUrl}${path}?${query}`;
      const { data } = await firstValueFrom(
        this.http.get<T>(url, {
          headers: { 'X-MBX-APIKEY': apiKey },
          timeout: 10000,
        }),
      );
      return data;
    };

    try {
      return await attempt();
    } catch (e) {
      const { code, msg } = this.extractErrInfo(e);
      // Timestamp fora da janela: re-sincroniza e tenta 1x novamente
      if (msg.includes('Timestamp') || msg.includes('-1021')) {
        this.logger.warn(
          `Timestamp fora da janela (-1021). Re-sincronizando tempo e tentando novamente...`,
        );
        await this.syncServerTime();
        return attempt();
      }

      this.logger.error(`Erro Binance [${code}]: ${msg}`);
      throw new Error(`Binance error: ${msg}`);
    }
  }

  async signedPost<T>(
    path: string,
    apiKey: string,
    apiSecret: string,
    params: Record<string, any> = {},
  ): Promise<T> {
    if (!Number.isFinite(this.timeOffsetMs)) {
      await this.syncServerTime();
    }

    const attempt = async () => {
      const query = this.buildSignedQuery(params, apiSecret);
      const url = `${this.baseUrl}${path}`;
      const { data } = await firstValueFrom(
        this.http.post<T>(url, query, {
          headers: {
            'X-MBX-APIKEY': apiKey,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 10000,
        }),
      );
      return data;
    };

    try {
      return await attempt();
    } catch (e) {
      const { code, msg } = this.extractErrInfo(e);
      if (msg.includes('Timestamp') || msg.includes('-1021')) {
        this.logger.warn(
          `Timestamp fora da janela (-1021). Re-sincronizando tempo e tentando novamente...`,
        );
        await this.syncServerTime();
        return attempt();
      }
      this.logger.error(`Erro Binance [${code}]: ${msg}`);
      throw new Error(`Binance error: ${msg}`);
    }
  }

  async signedDelete<T>(
    path: string,
    apiKey: string,
    apiSecret: string,
    params: Record<string, any> = {},
  ): Promise<T> {
    if (!Number.isFinite(this.timeOffsetMs)) {
      await this.syncServerTime();
    }

    const attempt = async () => {
      const query = this.buildSignedQuery(params, apiSecret);
      const url = `${this.baseUrl}${path}?${query}`;
      const { data } = await firstValueFrom(
        this.http.delete<T>(url, {
          headers: { 'X-MBX-APIKEY': apiKey },
          timeout: 10000,
        }),
      );
      return data;
    };

    try {
      return await attempt();
    } catch (e) {
      const { code, msg } = this.extractErrInfo(e);
      if (msg.includes('Timestamp') || msg.includes('-1021')) {
        this.logger.warn(
          `Timestamp fora da janela (-1021). Re-sincronizando tempo e tentando novamente...`,
        );
        await this.syncServerTime();
        return attempt();
      }
      this.logger.error(`Erro Binance [${code}]: ${msg}`);
      throw new Error(`Binance error: ${msg}`);
    }
  }

  // ===== HTTP UNSIGNED =====
  async unsignedGet<T>(
    path: string,
    params: Record<string, any> = {},
  ): Promise<T> {
    const query = new URLSearchParams(params).toString();
    const url = `${this.baseUrl}${path}?${query}`;
    this.logger.log(`GET ${url}`);
    const { data } = await firstValueFrom(
      this.http.get<T>(url, { timeout: 10000 }),
    );
    return data;
  }
}
