export const BinanceClientStub = {
  signedGet: jest.fn().mockResolvedValue({
    balances: [
      { asset: 'USDT', free: '100', locked: '0' },
      { asset: 'BTC', free: '0.002', locked: '0' },
      { asset: 'XYZ', free: '0', locked: '0' }, // filtrado
    ],
  }),
};
