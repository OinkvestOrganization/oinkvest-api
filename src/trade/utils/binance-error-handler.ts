import { BadRequestException } from '@nestjs/common';

export class BinanceErrorHandler {
  static handle(error: any): never {
    const binanceError = error.response?.data;
    const code = binanceError?.code;
    const message = binanceError?.msg;

    // Erros específicos com mensagens amigáveis
    const errorMap: Record<string, string> = {
      '1000': 'Requisição inválida',
      '1001': 'Serviço temporariamente indisponível. Tente novamente.',
      '1003': 'Limite de requisições atingido. Aguarde alguns segundos.',
      '1007': 'Ordem não pode ser processada neste momento',
      '1013': 'Quantidade ou preço inválido para este par',
      '1015': 'Limite de ordens atingido. Tente novamente mais tarde.',
      '1021': 'Sincronização de horário. Tente novamente.',
      '2010': 'Saldo insuficiente para realizar a operação',
      '2011': 'Ordem não encontrada ou já foi executada',
    };

    // Converter código negativo para string positiva para busca
    const codeKey = Math.abs(code).toString();
    const friendlyMessage =
      errorMap[codeKey] || message || 'Erro ao processar a ordem';

    throw new BadRequestException({
      statusCode: 400,
      message: friendlyMessage,
      binanceCode: code,
      binanceMessage: message,
    });
  }

  static isRateLimitError(error: any): boolean {
    return error.response?.data?.code === -1003;
  }

  static isTimestampError(error: any): boolean {
    return error.response?.data?.code === -1021;
  }

  static isInsufficientBalanceError(error: any): boolean {
    return error.response?.data?.code === -2010;
  }
}
