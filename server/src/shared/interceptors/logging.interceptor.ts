import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { JwtPayload } from '../../modules/auth/domain/auth.types.js';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const res = context.switchToHttp().getResponse<Response>();
    const { method, url } = req;
    const userId = req.user?.sub ?? 'anonymous';
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
