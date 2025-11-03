import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(() => {
    strategy = new JwtStrategy();
  });

  it('deve ser definido', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('deve retornar um objeto de usuário com userId e email a partir do payload', () => {
      const payload = { sub: 'user-id-1', email: 'test@example.com' };
      const result = strategy.validate(payload);

      expect(result).toEqual({
        userId: 'user-id-1',
        email: 'test@example.com',
      });
    });
  });
});
