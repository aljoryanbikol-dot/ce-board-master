/**
 * TransformInterceptor — Wraps all successful responses in the standard envelope.
 *
 * Per the API Contract Specification (Phase 4), all success responses follow:
 * {
 *   data: <controller return value>,
 *   meta: {
 *     timestamp: ISO 8601,
 *     requestId: string,
 *     pagination?: { cursor, hasMore, total }
 *   }
 * }
 *
 * Controllers that need to include pagination must return an object shaped as:
 * { data: T[], pagination: { cursor, hasMore, total } }
 *
 * The interceptor detects the pagination key and lifts it into the meta object.
 *
 * @see src/common/types/paginated-response.type.ts
 */
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

interface PaginationMeta {
  cursor?: string;
  hasMore?: boolean;
  total?: number;
}

interface ControllerResponseWithPagination<T> {
  data: T;
  pagination?: PaginationMeta;
}

interface ApiSuccessResponse<T> {
  data: T;
  meta: {
    timestamp: string;
    requestId: string;
    pagination?: PaginationMeta;
  };
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T | ControllerResponseWithPagination<T>, ApiSuccessResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T | ControllerResponseWithPagination<T>>,
  ): Observable<ApiSuccessResponse<T>> {
    const request = context.switchToHttp().getRequest<{ id?: string }>();
    const requestId = request.id ?? 'unknown';
    const timestamp = new Date().toISOString();

    return next.handle().pipe(
      map((value) => {
        // Detect if controller returned a paginated response
        if (
          value !== null &&
          typeof value === 'object' &&
          'data' in value &&
          'pagination' in value
        ) {
          const { data, pagination } = value as ControllerResponseWithPagination<T>;
          return {
            data,
            meta: { timestamp, requestId, pagination },
          };
        }

        return {
          data: value as T,
          meta: { timestamp, requestId },
        };
      }),
    );
  }
}
