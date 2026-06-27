/**
 * @file login.service.spec.ts
 * @module Auth/Tests
 *
 * Unit tests for LoginService.
 * Covers all authentication paths, lockout logic, MFA, and audit logging.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { LoginService } from '../services/login.service';

// ── Mock factories ─────────────────────────────────────────────────────────────

const activeUser = {
  id:           'user-001',
  email:        'juan@example.com',
  passwordHash: '$argon2id$validhash',
  isVerified:   true,
  isActive:     true,
  status:       'active',
  deletedAt:    null,
  role:         { slug: 'free_user' },
};

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    update:     vi.fn().mockResolvedValue({}),
  },
  loginAttempt: { create: vi.fn().mockResolvedValue({}) },
};

const mockPasswordService = {
  verify: vi.fn(),
};

const mockTokenService = {
  generateTokenPair: vi.fn().mockResolvedValue({
    accessToken:     'jwt-access-token',
    rawRefreshToken: 'raw-refresh-token',
    expiresIn:       900,
  }),
};

const mockLockoutService = {
  getLockoutStatus: vi.fn().mockResolvedValue({ isLocked: false, remainingSeconds: 0, failureCount: 0 }),
  recordFailure:    vi.fn().mockResolvedValue(false),
  clearLockout:     vi.fn().mockResolvedValue(undefined),
};

const mockMfaService = {
  isMfaEnabled: vi.fn().mockResolvedValue(false),
  verifyTotp:   vi.fn().mockResolvedValue(true),
};

const buildService = () =>
  new LoginService(
    mockPrisma as any,
    mockPasswordService as any,
    mockTokenService as any,
    mockLockoutService as any,
    mockMfaService as any,
  );

const validInput = {
  email:     'juan@example.com',
  password:  'SecurePass1!',
  ipAddress: '1.2.3.4',
  userAgent: 'Mozilla/5.0',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LoginService', () => {
  let service: LoginService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = buildService();
    mockPrisma.user.findUnique.mockResolvedValue(activeUser);
    mockPasswordService.verify.mockResolvedValue(true);
  });

  // ── Success paths ───────────────────────────────────────────────────────────

  describe('login() — success', () => {
    it('should return tokenPair and user on valid credentials', async () => {
      const result = await service.login(validInput);

      expect(result.tokenPair.accessToken).toBe('jwt-access-token');
      expect(result.user.id).toBe('user-001');
      expect(result.user.email).toBe('juan@example.com');
    });

    it('should call generateTokenPair with the authenticated user + metadata', async () => {
      await service.login(validInput);

      expect(mockTokenService.generateTokenPair).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-001', email: 'juan@example.com' }),
        '1.2.3.4',
        'Mozilla/5.0',
      );
    });

    it('should clear the lockout counter on success', async () => {
      await service.login(validInput);
      expect(mockLockoutService.clearLockout).toHaveBeenCalledWith('user-001');
    });

    it('should record a successful audit log entry', async () => {
      await service.login(validInput);
      expect(mockPrisma.loginAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ succeeded: true }) }),
      );
    });

    it('should update lastLoginAt and lastLoginIp', async () => {
      await service.login(validInput);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ lastLoginAt: expect.any(Date), lastLoginIp: '1.2.3.4' }),
        }),
      );
    });
  });

  // ── Unknown email ───────────────────────────────────────────────────────────

  describe('login() — unknown email', () => {
    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
    });

    it('should throw UnauthorizedException with INVALID_CREDENTIALS', async () => {
      await expect(service.login(validInput)).rejects.toThrow(UnauthorizedException);
    });

    it('should still run password.verify() to prevent timing attacks', async () => {
      await service.login(validInput).catch(() => {});
      // verify must be called (with the dummy hash)
      expect(mockPasswordService.verify).toHaveBeenCalled();
    });

    it('should record IP-level failure for unknown email', async () => {
      await service.login(validInput).catch(() => {});
      expect(mockLockoutService.recordFailure).toHaveBeenCalledWith(undefined, '1.2.3.4');
    });
  });

  // ── Wrong password ──────────────────────────────────────────────────────────

  describe('login() — wrong password', () => {
    beforeEach(() => {
      mockPasswordService.verify.mockResolvedValue(false);
    });

    it('should throw UnauthorizedException with INVALID_CREDENTIALS', async () => {
      await expect(service.login(validInput)).rejects.toThrow(UnauthorizedException);
    });

    it('should record a failure in the lockout service', async () => {
      await service.login(validInput).catch(() => {});
      expect(mockLockoutService.recordFailure).toHaveBeenCalledWith('user-001', '1.2.3.4');
    });

    it('should record a failed audit log entry', async () => {
      await service.login(validInput).catch(() => {});
      expect(mockPrisma.loginAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ succeeded: false }) }),
      );
    });

    it('should throw ACCOUNT_LOCKED when lockout threshold reached', async () => {
      mockLockoutService.recordFailure.mockResolvedValue(true); // threshold hit

      const error = await service.login(validInput).catch((e) => e);
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error.getResponse() as any).code).toBe('ACCOUNT_LOCKED');
    });
  });

  // ── Account already locked ──────────────────────────────────────────────────

  describe('login() — pre-locked account', () => {
    beforeEach(() => {
      mockLockoutService.getLockoutStatus.mockResolvedValue({
        isLocked: true,
        remainingSeconds: 840,
        failureCount: 5,
      });
    });

    it('should throw ForbiddenException ACCOUNT_LOCKED before running Argon2', async () => {
      await expect(service.login(validInput)).rejects.toThrow(ForbiddenException);
      // Password should NOT be verified — save the Argon2 work
      expect(mockPasswordService.verify).not.toHaveBeenCalled();
    });
  });

  // ── Unverified account ──────────────────────────────────────────────────────

  describe('login() — unverified account', () => {
    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...activeUser, isVerified: false });
    });

    it('should throw ForbiddenException ACCOUNT_NOT_VERIFIED', async () => {
      const error = await service.login(validInput).catch((e) => e);
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error.getResponse() as any).code).toBe('ACCOUNT_NOT_VERIFIED');
    });
  });

  // ── Suspended account ───────────────────────────────────────────────────────

  describe('login() — suspended account', () => {
    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...activeUser,
        isActive: false,
        status: 'suspended',
      });
    });

    it('should throw ForbiddenException ACCOUNT_SUSPENDED', async () => {
      const error = await service.login(validInput).catch((e) => e);
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error.getResponse() as any).code).toBe('ACCOUNT_SUSPENDED');
    });
  });

  // ── MFA paths ───────────────────────────────────────────────────────────────

  describe('login() — MFA required', () => {
    beforeEach(() => {
      mockMfaService.isMfaEnabled.mockResolvedValue(true);
    });

    it('should throw ForbiddenException MFA_REQUIRED if no mfaCode provided', async () => {
      const error = await service.login(validInput).catch((e) => e);
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error.getResponse() as any).code).toBe('MFA_REQUIRED');
    });

    it('should succeed when valid TOTP code provided', async () => {
      mockMfaService.verifyTotp.mockResolvedValue(true);
      const result = await service.login({ ...validInput, mfaCode: '123456' });
      expect(result.tokenPair.accessToken).toBe('jwt-access-token');
    });

    it('should throw UnauthorizedException MFA_INVALID on wrong TOTP code', async () => {
      mockMfaService.verifyTotp.mockResolvedValue(false);
      const error = await service.login({ ...validInput, mfaCode: '000000' }).catch((e) => e);
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error.getResponse() as any).code).toBe('MFA_INVALID');
    });

    it('should record failure and increment lockout on invalid MFA', async () => {
      mockMfaService.verifyTotp.mockResolvedValue(false);
      await service.login({ ...validInput, mfaCode: '000000' }).catch(() => {});
      expect(mockLockoutService.recordFailure).toHaveBeenCalled();
    });
  });

  // ── Soft-deleted account ────────────────────────────────────────────────────

  describe('login() — deleted account', () => {
    it('should throw UnauthorizedException for soft-deleted accounts', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...activeUser, deletedAt: new Date() });
      await expect(service.login(validInput)).rejects.toThrow(UnauthorizedException);
    });
  });
});
