/**
 * RequestIdMiddleware — Assigns a unique ID to every incoming request.
 *
 * The request ID is:
 * 1. Read from the incoming x-request-id header (if provided by the load balancer)
 * 2. Generated as a UUID v4 if not provided
 *
 * The request ID is:
 * - Attached to the request object (req.id)
 * - Returned in the x-request-id response header
 * - Included in all structured log entries
 * - Included in all error responses (meta.requestId)
 *
 * This enables distributed tracing: a single user request can be tracked
 * across all log entries and external API calls.
 *
 * @see common/interceptors/logging.interceptor.ts
 * @see common/filters/global-exception.filter.ts
 */
import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

interface RequestWithId {
  headers: Record<string, string | string[] | undefined>;
  id?: string;
}

interface ResponseWithHeader {
  setHeader(name: string, value: string): void;
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(
    req: RequestWithId,
    res: ResponseWithHeader,
    next: () => void,
  ): void {
    // Use incoming request ID from load balancer/proxy if available
    const existingId = req.headers['x-request-id'];
    const requestId = Array.isArray(existingId)
      ? existingId[0]
      : existingId ?? `req_${randomUUID().replace(/-/g, '').substring(0, 16)}`;

    req.id = requestId;
    res.setHeader('x-request-id', requestId);

    next();
  }
}
