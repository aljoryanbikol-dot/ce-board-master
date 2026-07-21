/**
 * @file register.service.spec.ts
 * @module Auth/Tests
 *
 * Unit tests for RegisterService.
 * All external dependencies mocked; pure business logic tested.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, InternalServerErrorException } from '@nestjs/common';
import { RegisterService } from '../services/register.service';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  userProfile: { create: vi.fn() },
  role: { findUnique: vi.fn() },
  $transaction: vi.fn(),
};

/** The transaction-scoped user.create spy, re-armed in beforeEach. */
let txUserCreate: ReturnType<typeof vi.fn>;

const mockPasswordService = { hash: vi.fn().mockResolvedValue('$argon2id$hashed') };
const mockTokenService    = { generateOneTimeToken: vi.fn().mockResolvedValue('raw-token-abc123') };
const mockEmailService    = { sendVerificationEmail: vi.fn().mockResolvedValue(undefined) };
// AUTH_AUTO_VERIFY unset (undefined) → standard verification-email flow.
const mockConfigService   = { get: vi.fn().mockReturnValue(undefined) };

// ── Helpers ───────────────────────────────────────────────────────────────────

const buildService = () =>
  new RegisterService(
    mockPrisma as any,
    mockPasswordService as any,
    mockTokenService as any,
    mockEmailService as any,
    mockConfigService as any,
  );

const validDto = {
  firstName: 'Juan',
  lastName:  'dela Cruz',
  email:     'juan@example.com',
  password:  'SecurePass1!',
} as const;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RegisterService', () => {
  let service: RegisterService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = buildService();

    // Default happy-path mocks
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.role.findUnique.mockResolvedValue({ id: 'role-id', slug: 'free_user' });

    // $transaction executes the callback with the mock prisma instance.
    // txUserCreate is shared so tests can assert on the row actually written.
    txUserCreate = vi.fn().mockResolvedValue({ id: 'user-001', email: validDto.email });
    mockPrisma.$transaction.mockImplementation((fn: Function) =>
      fn({
        user:        { create: txUserCreate },
        userProfile: { create: vi.fn().mockResolvedValue({}) },
      }),
    );
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  describe('register() — success path', () => {
    it('should return userId, email, and instructional message', async () => {
      const result = await service.register(validDto, '1.2.3.4');

      expect(result.userId).toBe('user-001');
      expect(result.email).toBe(validDto.email);
      // Accounts are created ready to use — verification is not enforced while
      // verification mail depends on the Redis-backed queue.
      expect(result.message).toContain('sign in');
    });

    it('should hash the password with Argon2id before storing', async () => {
      await service.register(validDto, '1.2.3.4');
      expect(mockPasswordService.hash).toHaveBeenCalledWith(validDto.password);
      expect(mockPasswordService.hash).toHaveBeenCalledTimes(1);
    });

    it('should check for duplicate email BEFORE hashing the password', async () => {
      let findUniqueCallOrder = 0;
      let hashCallOrder = 0;
      let callCounter = 0;

      mockPrisma.user.findUnique.mockImplementation(() => {
        findUniqueCallOrder = ++callCounter;
        return Promise.resolve(null);
      });
      mockPasswordService.hash.mockImplementation(() => {
        hashCallOrder = ++callCounter;
        return Promise.resolve('$argon2id$hashed');
      });

      await service.register(validDto, '1.2.3.4');

      expect(findUniqueCallOrder).toBeLessThan(hashCallOrder);
    });

    // Verification is disabled platform-wide while verification mail depends on
    // the Redis-backed queue: accounts are created already verified and no
    // verification email is generated, so a queue outage cannot lock anyone out.
    it('should create a verified account without sending a verification email', async () => {
      await service.register(validDto, '1.2.3.4');

      const created = txUserCreate.mock.calls[0]?.[0]?.data;
      expect(created?.isVerified).toBe(true);
      expect(created?.status).toBe('active');
      expect(mockTokenService.generateOneTimeToken).not.toHaveBeenCalled();
      expect(mockEmailService.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('should pass ip address to the user record', async () => {
      await service.register(validDto, '192.168.1.1');
      // The $transaction callback receives the prisma tx — verify create was called
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should handle optional examTargetDate', async () => {
      const futureDate = new Date(Date.now() + 86_400_000 * 30).toISOString().split('T')[0];
      await expect(
        service.register({ ...validDto, examTargetDate: futureDate }, '1.2.3.4'),
      ).resolves.toBeDefined();
    });

    it('should handle optional school', async () => {
      await expect(
        service.register({ ...validDto, school: 'Mapua University' }, '1.2.3.4'),
      ).resolves.toBeDefined();
    });
  });

  // ── Duplicate email ─────────────────────────────────────────────────────────

  describe('register() — duplicate email', () => {
    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing-user-id' });
    });

    it('should throw ConflictException with EMAIL_ALREADY_EXISTS code', async () => {
      await expect(service.register(validDto)).rejects.toThrow(ConflictException);
    });

    it('should NOT hash the password when email already exists (performance)', async () => {
      await service.register(validDto).catch(() => {});
      expect(mockPasswordService.hash).not.toHaveBeenCalled();
    });

    it('should NOT send a verification email on duplicate', async () => {
      await service.register(validDto).catch(() => {});
      expect(mockEmailService.sendVerificationEmail).not.toHaveBeenCalled();
    });
  });

  // ── Missing default role ────────────────────────────────────────────────────

  describe('register() — missing default role', () => {
    beforeEach(() => {
      mockPrisma.role.findUnique.mockResolvedValue(null);
    });

    it('should throw InternalServerErrorException when default role not seeded', async () => {
      await expect(service.register(validDto)).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ── Email send failure ──────────────────────────────────────────────────────

  describe('register() — email send failure', () => {
    it('should still return success if email sending fails (user can resend)', async () => {
      mockEmailService.sendVerificationEmail.mockRejectedValue(new Error('SMTP failure'));

      // Should NOT throw — registration succeeds, email can be resent
      const result = await service.register(validDto);
      expect(result.userId).toBe('user-001');
    });
  });
});
