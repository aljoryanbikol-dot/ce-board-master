'use client';
import { toast as sonnerToast } from 'sonner';
import { ApiError } from '@/lib/api/types';

/** Thin wrapper so the app speaks in one voice and handles ApiError nicely. */
export const toast = {
  success: (message: string, description?: string) => sonnerToast.success(message, { description }),
  error: (message: string, description?: string) => sonnerToast.error(message, { description }),
  info: (message: string, description?: string) => sonnerToast(message, { description }),
  /** Turn any thrown error into a useful toast. Free-tier limit hits get an
   * upgrade-forward prompt instead of a generic error, per the Free plan spec
   * ("explain Premium benefits instead of showing an error"). */
  fromError: (err: unknown, fallback = 'Something went wrong') => {
    if (err instanceof ApiError && err.code === 'FREE_TIER_LIMIT_REACHED') {
      sonnerToast(err.message, {
        description: 'Go Premium for unlimited practice, mock exams, AI Tutor, and full library access. See plans and pricing.',
        action: { label: 'Upgrade', onClick: () => { window.location.href = '/subscription'; } },
      });
    } else if (err instanceof ApiError) {
      sonnerToast.error(err.message || fallback, { description: err.field ? `Field: ${err.field}` : undefined });
    } else if (err instanceof Error) {
      sonnerToast.error(err.message || fallback);
    } else {
      sonnerToast.error(fallback);
    }
  },
};
