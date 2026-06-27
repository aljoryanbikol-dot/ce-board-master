'use client';
import { toast as sonnerToast } from 'sonner';
import { ApiError } from '@/lib/api/types';

/** Thin wrapper so the app speaks in one voice and handles ApiError nicely. */
export const toast = {
  success: (message: string, description?: string) => sonnerToast.success(message, { description }),
  error: (message: string, description?: string) => sonnerToast.error(message, { description }),
  info: (message: string, description?: string) => sonnerToast(message, { description }),
  /** Turn any thrown error into a useful toast. */
  fromError: (err: unknown, fallback = 'Something went wrong') => {
    if (err instanceof ApiError) {
      sonnerToast.error(err.message || fallback, { description: err.field ? `Field: ${err.field}` : undefined });
    } else if (err instanceof Error) {
      sonnerToast.error(err.message || fallback);
    } else {
      sonnerToast.error(fallback);
    }
  },
};
