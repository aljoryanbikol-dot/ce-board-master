/**
 * @file token.service.spec.ts
 * @module Auth/Tests
 *
 * Unit tests for TokenService.
 *
 * Tests:
 * - generateTokenPair: returns access token + raw refresh token; stores hash in DB
 * - validateAndRotateRefreshToken: filters by tokenType='refresh'; rotates correctly
 * - validateAndRotateRefreshToken: reuse detection revokes ALL user tokens
 * - validateAndRotateRefreshToken: rejects expired tokens
 * - validateAndRotateRefreshToken: rejects tokens for inactive users
 * - revokeRefreshToken: updates DB record
 * - revokeAllUserTokens: updates all matching records
 * - generateOneTimeToken / consumeOneTimeToken: end-to-end single-use flow
 * - consumeOneTimeToken: throws on expired token, wrong type, already-used token
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { TokenService } from '../services/token.service';
import { hashToken, generateSecureToken, calculateExpiry } from '../utils/token.utils';
import type { AuthenticatedUser } from '../auth.types';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockJwtService = {
  signAsync:   vi.fn().mockResolvedValue('jwt-access-token'),
  verifyAsync: vi.fn(),
};

const mockPrisma = {
  userAuthToken: {
    create:     vi.fn().mockResolvedValue({}),
    findFirst:  vi.fn(),
    findUnique: vi.fn(),
    update:     vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({ count: 2 }),
  },
};

const mockAuthConfig = {
  jwtPrivateKey:    'private-key',
  jwtPublicKey:     'public-key',
  accessTokenTtl:   900,
  refreshTokenTtl:  2_592_000,
  argon2Pepper:     'pepper',
  isProduction:     false,
  frontendUrl:      'https://app.test',
};

const mockConfigService = { get: vi.fn() };
const mockTierResolver = { resolve: vi.fn().mockResolvedValue('free') };

const buildService = () =>
  new TokenService(
    mockJwtService as any,
    mockPrisma as any,
    mockAuthConfig as any,
    mockConfigService as any,
    mockTierResolver as any,
  );

const activeUser: AuthenticatedUser = {
  id:               'user-001',
  email:            'juan@example.com',
  role:             'free_user',
  subscriptionTier: 'free',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TokenService', () => {
  let service: TokenService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = buildService();
  });

  // ── generateTokenPair ───────────────────────────────────────────────────────

  describe('generateTokenPair()', () => {
    it('should return an access token and raw refresh token', async () => {
      const result = await service.generateTokenPair(activeUser, '1.2.3.4', 'agent');

      expect(result.accessToken).toBe('jwt-access-token');
      expect(result.rawRefreshToken).toBeTruthy();
      expect(result.rawRefreshToken).toHaveLength(64); // 32 bytes → 64 hex
      expect(result.expiresIn).toBe(900);
    });

    it('should store the SHA-256 hash in DB, never the raw token', async () => {
      const result = await service.generateTokenPair(activeUser, '1.2.3.4', 'agent');

      const createCall = mockPrisma.userAuthToken.create.mock.calls[0][0];
      const storedHash = createCall.data.tokenHash;

      // Stored hash should not equal the raw token
      expect(storedHash).not.toBe(result.rawRefreshToken);
      // But hashing the raw token should produce the stored hash
      expect(hashToken(result.rawRefreshToken)).toBe(storedHash);
    });

    it('should store tokenType: refresh', async () => {
      await service.generateTokenPair(activeUser, '1.2.3.4', 'agent');
      const createCall = mockPrisma.userAuthToken.create.mock.calls[0][0];
      expect(createCall.data.tokenType).toBe('refresh');
    });
  });

  // ── validateAndRotateRefreshToken ───────────────────────────────────────────

  describe('validateAndRotateRefreshToken()', () => {
    const rawToken = generateSecureToken(32);

    const validRecord = {
      id:        'token-001',
      userId:    'user-001',
      tokenHash: hashToken(rawToken),
      tokenType: 'refresh',
      isRevoked: false,
      expiresAt: calculateExpiry(900),
      user:      activeUser,
    };

    it('should rotate the token and return a new token pair', async () => {
      mockPrisma.userAuthToken.findFirst.mockResolvedValue(validRecord);

      const result = await service.validateAndRotateRefreshToken(rawToken, '1.2.3.4', 'agent');

      expect(result.accessToken).toBe('jwt-access-token');
      expect(result.rawRefreshToken).not.toBe(rawToken); // new token issued
      // Old record should be revoked
      expect(mockPrisma.userAuthToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isRevoked: true }) }),
      );
    });

    it('FIX BUG-2: filters by tokenType=refresh (prevents one-time token cross-use)', async () => {
      mockPrisma.userAuthToken.findFirst.mockResolvedValue(null); // token not found

      await expect(
        service.validateAndRotateRefreshToken(rawToken),
      ).rejects.toThrow(UnauthorizedException);

      // Verify the WHERE clause included tokenType: 'refresh'
      const whereClause = mockPrisma.userAuthToken.findFirst.mock.calls[0][0].where;
      expect(whereClause.tokenType).toBe('refresh');
    });

    it('should throw REFRESH_TOKEN_INVALID for unknown token', async () => {
      mockPrisma.userAuthToken.findFirst.mockResolvedValue(null);

      const error = await service.validateAndRotateRefreshToken('unknown-token').catch((e) => e);
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error.getResponse() as any).code).toBe('REFRESH_TOKEN_INVALID');
    });

    it('should throw REFRESH_TOKEN_REUSE and revoke ALL sessions on reuse', async () => {
      mockPrisma.userAuthToken.findFirst.mockResolvedValue({ ...validRecord, isRevoked: true });

      const error = await service.validateAndRotateRefreshToken(rawToken).catch((e) => e);

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error.getResponse() as any).code).toBe('REFRESH_TOKEN_REUSE');
      // Should have called revokeAllUserTokens (updateMany with tokenType:refresh filter)
      expect(mockPrisma.userAuthToken.updateMany).toHaveBeenCalled();
    });

    it('should throw REFRESH_TOKEN_INVALID for expired token', async () => {
      const expiredRecord = { ...validRecord, expiresAt: new Date(Date.now() - 1000) };
      mockPrisma.userAuthToken.findFirst.mockResolvedValue(expiredRecord);

      const error = await service.validateAndRotateRefreshToken(rawToken).catch((e) => e);
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error.getResponse() as any).code).toBe('REFRESH_TOKEN_INVALID');
    });

    it('should throw for token belonging to inactive user', async () => {
      mockPrisma.userAuthToken.findFirst.mockResolvedValue({
        ...validRecord,
        user: { ...activeUser, isActive: false, status: 'suspended' },
      });

      const error = await service.validateAndRotateRefreshToken(rawToken).catch((e) => e);
      expect(error).toBeInstanceOf(UnauthorizedException);
    });
  });

  // ── revokeRefreshToken ──────────────────────────────────────────────────────

  describe('revokeRefreshToken()', () => {
    it('should update the matching token record to isRevoked=true', async () => {
      await service.revokeRefreshToken('some-raw-token');

      expect(mockPrisma.userAuthToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isRevoked: false }),
          data:  expect.objectContaining({ isRevoked: true }),
        }),
      );
    });

    it('should be idempotent (already-revoked token does not throw)', async () => {
      mockPrisma.userAuthToken.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.revokeRefreshToken('already-revoked')).resolves.not.toThrow();
    });
  });

  // ── revokeAllUserTokens ─────────────────────────────────────────────────────

  describe('revokeAllUserTokens()', () => {
    it('should revoke all active refresh tokens for the user', async () => {
      const result = await service.revokeAllUserTokens('user-001');

      expect(result).toBe(2); // mockPrisma.updateMany returns { count: 2 }
      expect(mockPrisma.userAuthToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-001', tokenType: 'refresh' }),
        }),
      );
    });
  });

  // ── generateOneTimeToken / consumeOneTimeToken ─────────────────────────────

  describe('generateOneTimeToken() + consumeOneTimeToken()', () => {
    it('should generate a raw token and store its hash with correct tokenType', async () => {
      const rawToken = await service.generateOneTimeToken('user-001', 'email_verify');

      expect(rawToken).toHaveLength(64); // 32 bytes → 64 hex
      const createCall = mockPrisma.userAuthToken.create.mock.calls[0][0];
      expect(createCall.data.tokenType).toBe('email_verify');
      expect(createCall.data.tokenHash).toBe(hashToken(rawToken));
    });

    it('should set 24h TTL for email_verify, 1h TTL for password_reset', async () => {
      const now = Date.now();

      await service.generateOneTimeToken('user-001', 'email_verify');
      const verifyExpiry = mockPrisma.userAuthToken.create.mock.calls[0][0].data.expiresAt as Date;
      const verifyTtlHours = (verifyExpiry.getTime() - now) / (1000 * 60 * 60);
      expect(verifyTtlHours).toBeGreaterThan(23.9);
      expect(verifyTtlHours).toBeLessThan(24.1);

      vi.clearAllMocks();

      await service.generateOneTimeToken('user-001', 'password_reset');
      const resetExpiry = mockPrisma.userAuthToken.create.mock.calls[0][0].data.expiresAt as Date;
      const resetTtlHours = (resetExpiry.getTime() - now) / (1000 * 60 * 60);
      expect(resetTtlHours).toBeGreaterThan(0.99);
      expect(resetTtlHours).toBeLessThan(1.01);
    });

    it('consumeOneTimeToken: returns userId for valid token', async () => {
      const rawToken  = generateSecureToken(32);
      const tokenHash = hashToken(rawToken);

      mockPrisma.userAuthToken.findFirst.mockResolvedValue({
        id:        'tok-001',
        userId:    'user-001',
        tokenHash,
        tokenType: 'email_verify',
        isRevoked: false,
        expiresAt: calculateExpiry(86_400),
      });

      const userId = await service.consumeOneTimeToken(rawToken, 'email_verify');

      expect(userId).toBe('user-001');
      // Token should be marked revoked
      expect(mockPrisma.userAuthToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isRevoked: true }) }),
      );
    });

    it('consumeOneTimeToken: throws VERIFY_TOKEN_INVALID for unknown token', async () => {
      mockPrisma.userAuthToken.findFirst.mockResolvedValue(null);

      const error = await service.consumeOneTimeToken('bad-token', 'email_verify').catch((e) => e);
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error.getResponse() as any).code).toBe('VERIFY_TOKEN_INVALID');
    });

    it('consumeOneTimeToken: throws for expired token', async () => {
      mockPrisma.userAuthToken.findFirst.mockResolvedValue({
        id: 'tok-001', userId: 'user-001', tokenType: 'email_verify',
        isRevoked: false,
        expiresAt: new Date(Date.now() - 1000), // already expired
      });

      const error = await service.consumeOneTimeToken('raw-token', 'email_verify').catch((e) => e);
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error.getResponse() as any).code).toBe('VERIFY_TOKEN_INVALID');
    });

    it('consumeOneTimeToken: uses correct error code for password_reset type', async () => {
      mockPrisma.userAuthToken.findFirst.mockResolvedValue(null);

      const error = await service.consumeOneTimeToken('bad', 'password_reset').catch((e) => e);
      expect((error.getResponse() as any).code).toBe('RESET_TOKEN_INVALID');
    });
  });
});
