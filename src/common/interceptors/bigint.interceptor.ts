import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BigIntSerializer } from '../serializers/bigint.serializer';

/**
 * Interceptor global para serializar BigInt como string
 * Previne: "Do not know how to serialize a BigInt"
 */
@Injectable()
export class BigIntInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        return BigIntSerializer.transform(data);
      }),
    );
  }
}
