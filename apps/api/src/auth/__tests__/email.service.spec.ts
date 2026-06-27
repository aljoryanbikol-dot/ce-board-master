/**
 * @file email.service.spec.ts
 * @module Auth/Tests
 *
 * Unit tests for EmailService.
 *
 * Tests:
 * - Each method enqueues a job with the correct job name and payload
 * - URL construction uses the injected frontendUrl
 * - Jobs are added with deduplication jobId where applicable
 * - Queue errors are propagated (email service does not swallow queue errors)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailService } from '../services/email.service';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockEmailQueue = { add: vi.fn().mockResolvedValue({ id: 'job-001' }) };

const mockConfigService = {
  get: vi.fn((key: string) => {
    const values: Record<string, string> = {
      FRONTEND_URL:    'https://app.ce-boardmaster.ph',
      EMAIL_FROM:      'noreply@ce-boardmaster.ph',
      EMAIL_FROM_NAME: 'CE Board Master',
    };
    return values[key] ?? null;
  }),
};

const buildService = () =>
  new EmailService(mockConfigService as any, mockEmailQueue as any);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = buildService();
  });

  // ── sendVerificationEmail ───────────────────────────────────────────────────

  describe('sendVerificationEmail()', () => {
    it('should enqueue a job with type "verification"', async () => {
      await service.sendVerificationEmail('juan@example.com', 'Juan', 'raw-token-abc123');

      expect(mockEmailQueue.add).toHaveBeenCalledWith(
        'send-email',
        expect.objectContaining({ type: 'verification' }),
        expect.any(Object),
      );
    });

    it('should include the correct verification URL in the payload', async () => {
      await service.sendVerificationEmail('juan@example.com', 'Juan', 'raw-token-abc123');

      const payload = mockEmailQueue.add.mock.calls[0][1];
      expect(payload.verificationUrl).toBe(
        'https://app.ce-boardmaster.ph/auth/verify-email?token=raw-token-abc123',
      );
    });

    it('should include the recipient email and first name', async () => {
      await service.sendVerificationEmail('juan@example.com', 'Juan', 'raw-token-abc123');
      const payload = mockEmailQueue.add.mock.calls[0][1];
      expect(payload.to).toBe('juan@example.com');
      expect(payload.firstName).toBe('Juan');
    });

    it('should set a deduplication jobId based on the token', async () => {
      await service.sendVerificationEmail('juan@example.com', 'Juan', 'raw-token-abc123xyzXYZ');
      const options = mockEmailQueue.add.mock.calls[0][2];
      expect(options.jobId).toContain('verify-');
    });

    it('should propagate queue errors', async () => {
      mockEmailQueue.add.mockRejectedValueOnce(new Error('Redis unavailable'));
      await expect(
        service.sendVerificationEmail('juan@example.com', 'Juan', 'token'),
      ).rejects.toThrow('Redis unavailable');
    });
  });

  // ── sendPasswordResetEmail ──────────────────────────────────────────────────

  describe('sendPasswordResetEmail()', () => {
    it('should enqueue a job with type "password_reset"', async () => {
      await service.sendPasswordResetEmail('juan@example.com', 'Juan', 'reset-token-xyz');

      const payload = mockEmailQueue.add.mock.calls[0][1];
      expect(payload.type).toBe('password_reset');
    });

    it('should include the correct reset URL in the payload', async () => {
      await service.sendPasswordResetEmail('juan@example.com', 'Juan', 'reset-token-xyz');

      const payload = mockEmailQueue.add.mock.calls[0][1];
      expect(payload.resetUrl).toBe(
        'https://app.ce-boardmaster.ph/auth/reset-password?token=reset-token-xyz',
      );
    });

    it('should set a deduplication jobId based on the token', async () => {
      await service.sendPasswordResetEmail('j@e.com', 'J', 'reset-tok-abcXYZ123456');
      const options = mockEmailQueue.add.mock.calls[0][2];
      expect(options.jobId).toContain('reset-');
    });
  });

  // ── sendPasswordChangedEmail ────────────────────────────────────────────────

  describe('sendPasswordChangedEmail()', () => {
    it('should enqueue a job with type "password_changed"', async () => {
      await service.sendPasswordChangedEmail('juan@example.com', 'Juan');

      const payload = mockEmailQueue.add.mock.calls[0][1];
      expect(payload.type).toBe('password_changed');
      expect(payload.to).toBe('juan@example.com');
      expect(payload.firstName).toBe('Juan');
    });

    it('should include a changedAt ISO timestamp in the payload', async () => {
      await service.sendPasswordChangedEmail('juan@example.com', 'Juan');
      const payload = mockEmailQueue.add.mock.calls[0][1];
      expect(payload.changedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });
});
