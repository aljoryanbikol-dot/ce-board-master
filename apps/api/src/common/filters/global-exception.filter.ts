/**
 * GlobalExceptionFilter — Catches and formats ALL unhandled exceptions.
 *
 * Responsibilities:
 * 1. Format all errors into the standard API error envelope:
 *    { error: { code, message, statusCode, field? }, meta: { timestamp, requestId } }
 * 2. Log errors with full context (requestId, userId, path, method)
 * 3. Send P1 errors (5xx) to Sentry for alerting
 * 4. Ensure no stack traces or internal details leak to API consumers
 *
 * Error classification:
 * - HttpException (NestJS): Use the provided status code and message
 * - ZodError (validation): Convert to 422 with field-level details
 * - PrismaClientKnownRequestError: Map to appropriate HTTP status
 * - All others: 500 Internal Server Error (safe message, full context to Sentry)
 *
 * This filter is registered globally in main.ts via app.useGlobalFilters().
 *
 * @see https://docs.nestjs.com/exception-filters
 */
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

/** Standard error response body (as per API Contract Specification Phase 4) */
interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    statusCode: number;
    field?: string;
    details?: Array<{ field: string; message: string }>;
  };
  meta: {
    timestamp: string;
    requestId: string;
  };
}

/** Maps Prisma error codes to HTTP status and error code strings */
const PRISMA_ERROR_MAP: Record<string, { status: number; code: string; message: string }> = {
  P2000: { status: 422, code: 'VALUE_TOO_LONG', message: 'The provided value is too long for this field.' },
  P2001: { status: 404, code: 'RECORD_NOT_FOUND', message: 'The requested record does not exist.' },
  P2002: { status: 409, code: 'UNIQUE_CONSTRAINT_VIOLATION', message: 'A record with this value already exists.' },
  P2003: { status: 409, code: 'FOREIGN_KEY_CONSTRAINT', message: 'Related record not found.' },
  P2025: { status: 404, code: 'RECORD_NOT_FOUND', message: 'The requested record does not exist.' },
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<{
      id?: string;
      url: string;
      method: string;
      user?: { id: string };
    }>();

    const requestId = request.id ?? 'unknown';
    const timestamp = new Date().toISOString();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred. Our team has been notified.';
    let field: string | undefined;
    let details: Array<{ field: string; message: string }> | undefined;

    // -------------------------------------------------------------------------
    // Handle NestJS HttpException (most common case)
    // -------------------------------------------------------------------------
    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === 'string') {
        message = response;
        errorCode = response.toUpperCase().replace(/\s+/g, '_');
      } else if (typeof response === 'object' && response !== null) {
        const res = response as Record<string, unknown>;
        message = (res['message'] as string) || message;
        // Application exceptions across the codebase set `code` (e.g.
        // AUTH_ERROR_CODES, SUBSCRIPTION_ERROR_CODES); `error` is Nest's own
        // default HttpException shape (e.g. "Forbidden"). Prefer the
        // application-specific code so the frontend can key off it exactly
        // (e.g. toast.fromError checking FREE_TIER_LIMIT_REACHED).
        errorCode = (res['code'] as string) || (res['error'] as string) || errorCode;
        field = res['field'] as string | undefined;
      }
    }

    // -------------------------------------------------------------------------
    // Handle Zod validation errors (from ZodValidationPipe)
    // -------------------------------------------------------------------------
    else if (exception instanceof ZodError) {
      statusCode = HttpStatus.UNPROCESSABLE_ENTITY;
      errorCode = 'VALIDATION_ERROR';
      message = 'Request validation failed. Check the details field for specific errors.';
      details = exception.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
    }

    // -------------------------------------------------------------------------
    // Handle Prisma known request errors (DB constraint violations, etc.)
    // -------------------------------------------------------------------------
    else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = PRISMA_ERROR_MAP[exception.code];
      if (mapped) {
        statusCode = mapped.status;
        errorCode = mapped.code;
        message = mapped.message;

        // Extract the field name from Prisma's meta for unique constraint violations
        if (exception.code === 'P2002' && exception.meta?.['target']) {
          const targets = exception.meta['target'] as string[];
          field = targets[0];
        }
      }
    }

    // -------------------------------------------------------------------------
    // Handle Prisma validation errors (invalid data shape)
    // -------------------------------------------------------------------------
    else if (exception instanceof Prisma.PrismaClientValidationError) {
      statusCode = HttpStatus.BAD_REQUEST;
      errorCode = 'INVALID_DATABASE_OPERATION';
      message = 'Invalid data provided.';
    }

    // -------------------------------------------------------------------------
    // Log and report all errors
    // -------------------------------------------------------------------------
    const logContext = {
      requestId,
      userId: request.user?.id,
      path: request.url,
      method: request.method,
      statusCode,
      errorCode,
    };

    if (statusCode >= 500) {
      // Server errors: log with full stack, report to Sentry
      this.logger.error(
        `[${requestId}] ${statusCode} ${errorCode}: ${message}`,
        exception instanceof Error ? exception.stack : String(exception),
        logContext,
      );
      // TODO Phase 6.3: Sentry.captureException(exception, { extra: logContext });
    } else if (statusCode >= 400) {
      // Client errors: log at warn level
      this.logger.warn(`[${requestId}] ${statusCode} ${errorCode}: ${message}`, logContext);
    }

    // -------------------------------------------------------------------------
    // Build and send the response
    // -------------------------------------------------------------------------
    const responseBody: ApiErrorResponse = {
      error: {
        code: errorCode,
        message,
        statusCode,
        ...(field && { field }),
        ...(details && { details }),
      },
      meta: {
        timestamp,
        requestId,
      },
    };

    httpAdapter.reply(ctx.getResponse(), responseBody, statusCode);
  }
}
