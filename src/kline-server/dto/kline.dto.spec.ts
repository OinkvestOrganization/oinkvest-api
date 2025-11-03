import { KlineDto } from './kline.dto';

describe('KlineDto', () => {
  const mockBinanceData = {
    e: 'kline',
    E: 1672531200000,
    s: 'BTCUSDT',
    k: {
      t: 1672531200000, // startTime
      T: 1672531259999, // closePriceTime
      s: 'BTCUSDT',
      i: '1m', // interval
      o: '16500.00', // openPrice
      c: '16501.00', // closePrice
      h: '16502.00', // highPrice
      l: '16499.00', // lowPrice
      v: '10.00', // volume
      n: 10, // numberOfTrades
      x: false, // closed
      q: '165000.00', // quoteAssetVolume
      V: '5.00', // takerBuyBaseAssetVolume
      Q: '82500.00', // takerBuyQuoteAssetVolume
    },
  };

  const mockHistoryData = [
    1672531200000, // 0: startTime
    '16500.00', // 1: openPrice
    '16502.00', // 2: highPrice
    '16499.00', // 3: lowPrice
    '16501.00', // 4: closePrice
    '10.00', // 5: volume
    1672531259999, // 6: closePriceTime
    '165000.00', // 7: quoteAssetVolume
    10, // 8: numberOfTrades
    '5.00', // 9: takerBuyBaseAssetVolume
    '82500.00', // 10: takerBuyQuoteAssetVolume
    '0', // 11: Ignore (Unused field in DTO)
  ];

  describe('fromBinance', () => {
    it('deve mapear corretamente os dados do stream da Binance para KlineDto', () => {
      const klineData = mockBinanceData.k;
      const dto = KlineDto.fromBinance(klineData);

      expect(dto).toBeInstanceOf(KlineDto);
      expect(dto.startTime).toBe(klineData.t);
      expect(dto.openPrice).toBe(klineData.o);
      expect(dto.highPrice).toBe(klineData.h);
      expect(dto.lowPrice).toBe(klineData.l);
      expect(dto.closePrice).toBe(klineData.c);
      expect(dto.volume).toBe(klineData.v);
      expect(dto.closePriceTime).toBe(klineData.T);
      expect(dto.quoteAssetVolume).toBe(klineData.q);
      expect(dto.numberOfTrades).toBe(klineData.n);
      expect(dto.takerBuyBaseAssetVolume).toBe(klineData.V);
      expect(dto.takerBuyQuoteAssetVolume).toBe(klineData.Q);
      expect(dto.symbol).toBe(klineData.s);
      expect(dto.interval).toBe(klineData.i);
      expect(dto.closed).toBe(klineData.x);
    });

    it('deve lidar com valores de string vazios ou nulos (consistência de dados)', () => {
      const incompleteData = {
        t: 123,
        s: 'TEST',
        i: '1m',
        x: true,
        o: '',
        c: null,
        h: '100',
        l: '90',
        v: '10',
        T: 456,
        q: '1000',
        n: 5,
        V: '5',
        Q: '500',
      };

      const dto = KlineDto.fromBinance(incompleteData as any);

      expect(dto.openPrice).toBe('');
      expect(dto.closePrice).toBe(null);
      expect(dto.highPrice).toBe('100');
    });
  });

  describe('fromHistory', () => {
    const symbol = 'ETHUSDT';
    const interval = '5m';

    it('deve mapear corretamente os dados históricos da Binance para KlineDto', () => {
      const dto = KlineDto.fromHistory(mockHistoryData, symbol, interval);

      expect(dto).toBeInstanceOf(KlineDto);
      expect(dto.startTime).toBe(mockHistoryData[0]);
      expect(dto.openPrice).toBe(mockHistoryData[1]);
      expect(dto.highPrice).toBe(mockHistoryData[2]);
      expect(dto.lowPrice).toBe(mockHistoryData[3]);
      expect(dto.closePrice).toBe(mockHistoryData[4]);
      expect(dto.volume).toBe(mockHistoryData[5]);
      expect(dto.closePriceTime).toBe(mockHistoryData[6]);
      expect(dto.quoteAssetVolume).toBe(mockHistoryData[7]);
      expect(dto.numberOfTrades).toBe(mockHistoryData[8]);
      expect(dto.takerBuyBaseAssetVolume).toBe(mockHistoryData[9]);
      expect(dto.takerBuyQuoteAssetVolume).toBe(mockHistoryData[10]);
      expect(dto.symbol).toBe(symbol);
      expect(dto.interval).toBe(interval);
      expect(dto.closed).toBe(true); // Dados históricos são sempre fechados
    });

    it('deve garantir que os campos de preço e volume são strings (precisão dos cálculos)', () => {
      const dto = KlineDto.fromHistory(mockHistoryData, symbol, interval);

      // A Binance retorna preços e volumes como strings para manter a precisão.
      // O DTO deve manter isso.
      expect(typeof dto.openPrice).toBe('string');
      expect(typeof dto.closePrice).toBe('string');
      expect(typeof dto.volume).toBe('string');
      expect(typeof dto.quoteAssetVolume).toBe('string');
    });
  });
});
