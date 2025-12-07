// src/auth/guards/owner.guard.ts

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class OwnerGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const paramId = request.params.id;

    if (!user || !paramId) {
      return false;
    }

    if (user.userId !== paramId) {
      throw new ForbiddenException(
        'Você não tem permissão para acessar este recurso.',
      );
    }

    // Se os IDs forem iguais, permite o acesso
    return true;
  }
}
