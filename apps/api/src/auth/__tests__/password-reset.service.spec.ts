/**
 * @file password-reset.service.spec.ts
 * @module Auth/Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PasswordResetService } from '../services/password-reset.service';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPrisma = {
  user: {
    findUnique:       vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update:           vi.fn().mockResolvedValue({}),
  },
  userProfile: { findUnique: vi.fn().mockResolvedValue({ firstName: 'Juan' }) },
};

const mockPasswordService = {
  hash:   vi.fn().mockResolvedValue('$argon2id$newhash'),
  verify: vi.fn().mockResolvedValue(true),
};

const mockTokenService = {
  generateOneTimeToken:  vi.fn().mockResolvedValue('raw-reset-token'),
  consumeOneTimeToken:   vi.fn().mockResolvedValue('user-001'),
  revokeAllUserTokens:   vi.fn().mockResolvedValue(3),
};

const mockEmailService = {
  sendPasswordResetEmail:   vi.fn().mockResolvedValue(undefined),
  sendPasswordChangedEmail: vi.fn().mockResolvedValue(undefined),
};

const buildService = () =>
  new PasswordResetService(
    mockPrisma as any,
    mockPasswordService as any,
    mockTokenService as any,
    mockEmailService as any,
  );

const mockUser: any = {
  id:    'user-001',
  email: 'juan@example.com',
  role:  'free_user',
  subscriptionTier: 'free',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PasswordResetService', () => {
  let service: PasswordResetService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = buildService();
  });

  // ── forgotPassword ──────────────────────────────────────────────────────────

  describe('forgotPassword()', () => {
    it('should always return a message (anti-enumeration)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const result = await service.forgotPassword('nobody@nowhere.com');
      expect(result.message).toBeDefined();
    });

    it('should queue reset email for active registered user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-001', isActive: true, profile: { firstName: 'Juan' },
      });

      await service.forgotPassword('juan@example.com');

      expect(mockTokenService.generateOneTimeToken).toHaveBeenCalledWith('user-001', 'password_reset');
      expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalled();
    });

    it('should NOT send email for inactive (suspended) user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', isActive: false });

      await service.forgotPassword('juan@example.com');

      expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should still return 200 if email sending fails', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', isActive: true, profile: { firstName: 'J' } });
      mockEmailService.sendPasswordResetEmail.mockRejectedValue(new Error('SMTP'));

      const result = await service.forgotPassword('juan@example.com');
      expect(result.message).toBeDefined();
    });
  });

  // ── resetPassword ───────────────────────────────────────────────────────────

  describe('resetPassword()', () => {
    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue({ email: 'juan@example.com' });
    });

    it('should update password hash and revoke all sessions', async () => {
      await service.resetPassword('valid-token', 'NewSecurePass1!');

      expect(mockPasswordService.hash).toHaveBeenCalledWith('NewSecurePass1!');
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { passwordHash: '$argon2id$newhash' } }),
      );
      expect(mockTokenService.revokeAllUserTokens).toHaveBeenCalledWith('user-001');
    });

    it('should send a password-changed security email', async () => {
      await service.resetPassword('valid-token', 'NewSecurePass1!');
      expect(mockEmailService.sendPasswordChangedEmail).toHaveBeenCalledWith(
        'juan@example.com',
        'Juan',
      );
    });

    it('should propagate token validation errors from consumeOneTimeToken', async () => {
      mockTokenService.consumeOneTimeToken.mockRejectedValue(
        new UnauthorizedException({ code: 'RESET_TOKEN_INVALID' }),
      );

      await expect(service.resetPassword('bad-token', 'NewPass1!')).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── changePassword ──────────────────────────────────────────────────────────

  describe('changePassword()', () => {
    beforeEach(() => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        passwordHash: '$argon2id$oldhash',
        email: 'juan@example.com',
      });
    });

    it('should update password and revoke all sessions', async () => {
      const result = await service.changePassword(mockUser, 'OldPass1!', 'NewPass1!');

      expect(result.sessionsRevoked).toBe(3);
      expect(mockPasswordService.verify).toHaveBeenCalledWith('OldPass1!', '$argon2id$oldhash');
      expect(mockPasswordService.hash).toHaveBeenCalledWith('NewPass1!');
      expect(mockTokenService.revokeAllUserTokens).toHaveBeenCalledWith('user-001');
    });

    it('should throw UnauthorizedException if current password is wrong', async () => {
      mockPasswordService.verify.mockResolvedValue(false);

      await expect(
        service.changePassword(mockUser, 'WrongPass1!', 'NewPass1!'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw BadRequestException for OAuth-only accounts (no password hash)', async () => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        passwordHash: null,
        email: 'oauth@example.com',
      });

      await expect(
        service.changePassword(mockUser, 'anything', 'NewPass1!'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
