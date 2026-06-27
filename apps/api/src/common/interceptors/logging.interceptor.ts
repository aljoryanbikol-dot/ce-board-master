/**
 * LoggingInterceptor — Structured request/response logging.
 *
 * Logs every API request and response with:
 * - Request ID (from x-request-id header or generated)
 * - HTTP method and path
 * - Response status code
 * - Duration in milliseconds
 * - User ID (when authenticated)
 *
 * Excludes from logging:
 * - /api/v1/health (too noisy, monitored separately)
 * - Static assets
 *
 * Uses Pino structured JSON format for machine-parseable logs.
 * In development, pino-pretty formats logs for human readability.
 *
 * @see main.ts for Pino logger initialization
 */
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

const EXCLUDED_PATHS = ['/api/v1/health', '/api/v1/health/detailed'];

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      id?: string;
      method: string;
      url: string;
      user?: { id: string };
    }>();

    const { method, url } = request;

    // Skip logging for excluded paths
    if (EXCLUDED_PATHS.some((path) => url.startsWith(path))) {
      return next.handle();
    }

    const requestId = request.id ?? 'unknown';
    const userId = request.user?.id;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse<{ statusCode: number }>();
          const duration = Date.now() - startTime;

          this.logger.log({
            requestId,
            userId,
            method,
            url,
            statusCode: response.statusCode,
            durationMs: duration,
          });
        },
        error: () => {
          // Errors are logged by GlobalExceptionFilter — don't double-log
        },
      }),
    );
  }
}
