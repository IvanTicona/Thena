import { Injectable, Logger } from '@nestjs/common';
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import { tap } from 'rxjs/operators';
import type { Observable } from 'rxjs';
import type { Response } from 'express';
import type { MaybeAuthenticatedRequest } from '../../modules/auth/domain/auth.types.js';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept<T>(context: ExecutionContext, next: CallHandler<T>): Observable<T> {
    const req = context.switchToHttp().getRequest<MaybeAuthenticatedRequest>();
    const res = context.switchToHttp().getResponse<Response>();
    const { method, url } = req;
    const userId = req.user?.sub ?? '-';
    const startAt = Date.now();

    return next.handle().pipe(
      tap(() => {
        const durationMs = Date.now() - startAt;
        const statusCode = res.statusCode;
        this.logger.log(
          `${method} ${url} | userId=${userId} | ${statusCode} | ${durationMs}ms`,
        );
      }),
    );
  }
}
