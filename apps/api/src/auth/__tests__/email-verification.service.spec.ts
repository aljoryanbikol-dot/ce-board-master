/**
 * @file email-verification.service.spec.ts
 * @module Auth/Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { EmailVerificationService } from '../services/email-verification.service';

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    update:     vi.fn().mockResolvedValue({}),
  },
};
const mockTokenService = {
  consumeOneTimeToken: vi.fn().mockResolvedValue('user-001'),
  generateOneTimeToken: vi.fn().mockResolvedValue('new-raw-token'),
};
const mockEmailService = {
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
};

const buildService = () =>
  new EmailVerificationService(mockPrisma as any, mockTokenService as any, mockEmailService as any);

describe('EmailVerificationService', () => {
  let service: EmailVerificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = buildService();
  });

  // ── verifyEmail ─────────────────────────────────────────────────────────────

  describe('verifyEmail()', () => {
    it('should activate the account on valid token', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isVerified: false, email: 'juan@example.com' });

      const result = await service.verifyEmail('valid-token-64chars');

      expect(result.message).toContain('verified');
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isVerified: true, status: 'active' }),
        }),
      );
    });

    it('should throw ConflictException ALREADY_VERIFIED if already verified', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isVerified: true });

      await expect(service.verifyEmail('valid-token')).rejects.toThrow(ConflictException);
    });

    it('should propagate UnauthorizedException from consumeOneTimeToken', async () => {
      const { UnauthorizedException } = await import('@nestjs/common');
      mockTokenService.consumeOneTimeToken.mockRejectedValue(
        new UnauthorizedException({ code: 'VERIFY_TOKEN_INVALID' }),
      );

      await expect(service.verifyEmail('bad-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── resendVerification ──────────────────────────────────────────────────────

  describe('resendVerification()', () => {
    it('should always return 200 message (anti-enumeration)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.resendVerification('nobody@nowhere.com');
      expect(result.message).toBeDefined();
    });

    it('should generate token and send email for unverified active user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-001',
        isVerified: false,
        isActive:   true,
        profile:    { firstName: 'Juan' },
      });

      await service.resendVerification('juan@example.com');

      expect(mockTokenService.generateOneTimeToken).toHaveBeenCalledWith('user-001', 'email_verify');
      expect(mockEmailService.sendVerificationEmail).toHaveBeenCalledWith(
        'juan@example.com',
        'Juan',
        'new-raw-token',
      );
    });

    it('should NOT send email for already-verified user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', isVerified: true, isActive: true });

      await service.resendVerification('juan@example.com');

      expect(mockEmailService.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('should NOT send email for suspended user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', isVerified: false, isActive: false });

      await service.resendVerification('juan@example.com');

      expect(mockEmailService.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('should return 200 even if email sending throws', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-001', isVerified: false, isActive: true, profile: { firstName: 'Juan' },
      });
      mockEmailService.sendVerificationEmail.mockRejectedValue(new Error('SMTP error'));

      // Should NOT throw
      const result = await service.resendVerification('juan@example.com');
      expect(result.message).toBeDefined();
    });
  });
});
