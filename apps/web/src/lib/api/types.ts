/**
 * @file types.ts — API envelope + error types, matching the backend contract
 * (apps/api Phase 4 API Contract). The frontend consumes these exactly.
 */

export interface PaginationMeta {
  cursor?: string | null;
  hasMore: boolean;
  total?: number;
}

export interface ApiMeta {
  timestamp?: string;
  requestId?: string;
  pagination?: PaginationMeta;
}

export interface ApiSuccess<T> {
  data: T;
  meta?: ApiMeta;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    statusCode: number;
    field?: string;
    details?: Array<{ field: string; message: string }>;
  };
  meta?: ApiMeta;
}

/** A typed API error thrown by the client. */
export class ApiError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly field?: string;
  readonly details?: Array<{ field: string; message: string }>;

  constructor(body: ApiErrorBody['error'] | { code: string; message: string; statusCode: number }) {
    super(body.message);
    this.name = 'ApiError';
    this.code = body.code;
    this.statusCode = body.statusCode;
    this.field = 'field' in body ? body.field : undefined;
    this.details = 'details' in body ? body.details : undefined;
  }

  get isAuth(): boolean { return this.statusCode === 401; }
  get isForbidden(): boolean { return this.statusCode === 403; }
  get isValidation(): boolean { return this.statusCode === 422 || this.code === 'VALIDATION_ERROR'; }
  get isNotFound(): boolean { return this.statusCode === 404; }
}
