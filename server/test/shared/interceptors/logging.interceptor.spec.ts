import { Logger } from '@nestjs/common';
import type { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { LoggingInterceptor } from '../../../src/shared/interceptors/logging.interceptor.js';

const makeContext = (
  opts: {
    method?: string;
    url?: string;
    userId?: string;
    statusCode?: number;
  } = {},
): ExecutionContext => {
  const { method = 'GET', url = '/test', userId, statusCode = 200 } = opts;
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method,
        url,
        user: userId ? { sub: userId } : undefined,
      }),
      getResponse: () => ({ statusCode }),
    }),
  } as unknown as ExecutionContext;
};

const makeHandler = (): CallHandler => ({ handle: () => of(null) });

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
    logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('logs method, url, userId and status code', (done) => {
    const ctx = makeContext({
      method: 'POST',
      url: '/api/users',
      userId: 'abc-123',
      statusCode: 201,
    });

    interceptor.intercept(ctx, makeHandler()).subscribe({
      complete: () => {
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('POST /api/users | userId=abc-123 | 201'),
        );
        done();
      },
    });
  });

  it('logs "-" as userId when request is unauthenticated', (done) => {
    const ctx = makeContext({ url: '/health' });

    interceptor.intercept(ctx, makeHandler()).subscribe({
      complete: () => {
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('userId=-'),
        );
        done();
      },
    });
  });

  it('includes duration in milliseconds', (done) => {
    const ctx = makeContext();

    interceptor.intercept(ctx, makeHandler()).subscribe({
      complete: () => {
        expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/\d+ms/));
        done();
      },
    });
  });
});
