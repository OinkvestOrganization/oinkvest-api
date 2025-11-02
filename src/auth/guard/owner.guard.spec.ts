import { OwnerGuard } from './owner.guard';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';

describe('OwnerGuard', () => {
  let guard: OwnerGuard;

  beforeEach(() => {
    guard = new OwnerGuard();
  });

  it('deve ser definido', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    const mockUser = { userId: 'user-id-1', email: 'test@example.com' };

    // Mock do ExecutionContext
    const createMockContext = (
      user: any,
      paramId: string | undefined,
    ): ExecutionContext =>
      ({
        switchToHttp: () => ({
          getRequest: () => ({
            user: user,
            params: { id: paramId },
          }),
        }),
      }) as unknown as ExecutionContext;

    it('deve retornar true se o ID do usuário no token for igual ao ID do parâmetro', () => {
      const context = createMockContext(mockUser, 'user-id-1');
      const result = guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('deve lançar ForbiddenException se o ID do usuário no token for diferente do ID do parâmetro', () => {
      const context = createMockContext(mockUser, 'user-id-2');
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow(
        'Você não tem permissão para acessar este recurso.',
      );
    });

    it('deve retornar false se o usuário não estiver presente no request (token inválido/ausente)', () => {
      const context = createMockContext(undefined, 'user-id-1');
      const result = guard.canActivate(context);
      expect(result).toBe(false);
    });

    it('deve retornar false se o ID do parâmetro não estiver presente', () => {
      const context = createMockContext(mockUser, undefined);
      const result = guard.canActivate(context);
      expect(result).toBe(false);
    });
  });
});
