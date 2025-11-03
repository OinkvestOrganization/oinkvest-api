import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class JwtAuthGuardStub implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    // injeta um usuário fake
    req.user = { userId: 'user_test_123', email: 'test@example.com' };
    return true;
  }
}
