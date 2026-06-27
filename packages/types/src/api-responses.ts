/**
 * API response envelope types — match Phase 4 API Contract exactly.
 * Used to type API client calls from frontend applications.
 */

export interface PaginationMeta {
  cursor?: string;
  hasMore: boolean;
  total?: number;
}

export interface ApiSuccessResponse<T> {
  data: T;
  meta: {
    timestamp: string;
    requestId: string;
    pagination?: PaginationMeta;
  };
}

export interface ApiErrorResponse {
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
