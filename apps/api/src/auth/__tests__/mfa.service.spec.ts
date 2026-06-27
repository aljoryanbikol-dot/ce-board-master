/**
 * @file mfa.service.spec.ts
 * @module Auth/Tests
 *
 * Unit tests for MfaService.
 * Tests TOTP generation, verification, backup codes, and enable/disable lifecycle.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MfaService } from '../services/mfa.service';
import { BadRequestException } from '@nestjs/common';
import * as speakeasy from 'speakeasy';

const mockPrisma = {
  mfaConfig: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
};

describe('MfaService', () => {
  let service: MfaService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MfaService(mockPrisma as any);
  });

  describe('setupMfa()', () => {
    it('should generate a valid TOTP secret and 8 backup codes', async () => {
      mockPrisma.mfaConfig.upsert.mockResolvedValue({});

      const result = await service.setupMfa('user-01', 'juan@example.com');

      expect(result.secret).toBeTruthy();
      expect(result.qrCodeUrl).toContain('otpauth://totp');
      expect(result.backupCodes).toHaveLength(8);
      // Each backup code should be uppercase hex
      result.backupCodes.forEach((code) => {
        expect(code).toMatch(/^[0-9A-F]{12}$/);
      });
    });

    it('should store hashed backup codes (not raw)', async () => {
      mockPrisma.mfaConfig.upsert.mockResolvedValue({});

      const result = await service.setupMfa('user-01', 'juan@example.com');

      // The stored data should contain hashed codes
      const upsertCall = mockPrisma.mfaConfig.upsert.mock.calls[0][0];
      const storedCodes: string[] = upsertCall.create.backupCodes;

      // Raw backup codes should NOT appear in stored codes
      result.backupCodes.forEach((rawCode) => {
        expect(storedCodes).not.toContain(rawCode);
      });

      // Stored codes should all be 64-char SHA-256 hashes
      storedCodes.forEach((hash) => {
        expect(hash).toHaveLength(64);
      });
    });
  });

  describe('verifyTotp()', () => {
    it('should return true for a valid TOTP code', async () => {
      // Generate a real secret for testing
      const { base32: secret } = speakeasy.generateSecret({ length: 20 });
      const validCode = speakeasy.totp({ secret, encoding: 'base32' });

      mockPrisma.mfaConfig.findUnique.mockResolvedValue({
        totpSecretEnc: secret,
        isEnabled: true,
      });
      mockPrisma.mfaConfig.update.mockResolvedValue({});

      const result = await service.verifyTotp('user-01', validCode);
      expect(result).toBe(true);
    });

    it('should return false for an invalid TOTP code', async () => {
      const { base32: secret } = speakeasy.generateSecret({ length: 20 });

      mockPrisma.mfaConfig.findUnique.mockResolvedValue({
        totpSecretEnc: secret,
        isEnabled: true,
      });
      mockPrisma.mfaConfig.update.mockResolvedValue({});

      const result = await service.verifyTotp('user-01', '000000');
      expect(result).toBe(false);
    });

    it('should throw BadRequestException if MFA not configured', async () => {
      mockPrisma.mfaConfig.findUnique.mockResolvedValue(null);

      await expect(service.verifyTotp('user-01', '123456')).rejects.toThrow(BadRequestException);
    });
  });

  describe('verifyBackupCode()', () => {
    it('should verify and consume a valid backup code', async () => {
      const { hashToken } = await import('../utils/token.utils');
      const rawCode = 'ABCDEF123456';
      const hashed = hashToken(rawCode);

      mockPrisma.mfaConfig.findUnique.mockResolvedValue({
        backupCodes: [hashed, 'other-hash'],
        isEnabled: true,
      });
      mockPrisma.mfaConfig.update.mockResolvedValue({});

      const result = await service.verifyBackupCode('user-01', rawCode);
      expect(result).toBe(true);

      // Verify code was removed
      const updateCall = mockPrisma.mfaConfig.update.mock.calls[0][0];
      expect(updateCall.data.backupCodes).not.toContain(hashed);
    });

    it('should return false for an invalid backup code', async () => {
      mockPrisma.mfaConfig.findUnique.mockResolvedValue({
        backupCodes: ['some-other-hash'],
        isEnabled: true,
      });

      const result = await service.verifyBackupCode('user-01', 'WRONG12345AB');
      expect(result).toBe(false);
    });
  });

  describe('isMfaEnabled()', () => {
    it('should return true if MFA is enabled', async () => {
      mockPrisma.mfaConfig.findUnique.mockResolvedValue({ isEnabled: true });
      expect(await service.isMfaEnabled('user-01')).toBe(true);
    });

    it('should return false if no MFA config exists', async () => {
      mockPrisma.mfaConfig.findUnique.mockResolvedValue(null);
      expect(await service.isMfaEnabled('user-01')).toBe(false);
    });
  });
});
