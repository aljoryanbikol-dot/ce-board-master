/**
 * @file password.service.spec.ts
 * @module Auth/Tests
 *
 * Unit tests for PasswordService.
 *
 * Tests cover:
 * - Hashing produces a valid Argon2id hash
 * - Correct password verification returns true
 * - Wrong password verification returns false
 * - Hash is never the same as plaintext (obvious but verified)
 * - Two calls with the same password produce different hashes (salt)
 * - Malformed hash returns false (not throws)
 * - Password strength validation rules
 *
 * Mocking: AuthConfig is mocked to provide a test pepper.
 * We do NOT mock argon2 itself — password hashing is security-critical
 * and must be tested against the real implementation.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PasswordService } from '../services/password.service';
import { AuthConfig } from '../config/auth.config';

// ── Test setup ────────────────────────────────────────────────────────────────

const mockAuthConfig = {
  argon2Pepper: 'test-pepper-value-that-is-at-least-32-chars-long',
  jwtPrivateKey: 'test',
  jwtPublicKey: 'test',
  accessTokenTtl: 900,
  refreshTokenTtl: 2592000,
  isProduction: false,
} satisfies Partial<AuthConfig>;

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(() => {
    service = new PasswordService(mockAuthConfig as AuthConfig);
  });

  // ── hash() ──────────────────────────────────────────────────────────────────

  describe('hash()', () => {
    it('should produce an Argon2id hash string', async () => {
      const hash = await service.hash('TestPassword1!');
      expect(hash).toMatch(/^\$argon2id\$/);
    });

    it('should produce different hashes for the same password (salt)', async () => {
      const password = 'SamePassword1!';
      const hash1 = await service.hash(password);
      const hash2 = await service.hash(password);
      expect(hash1).not.toBe(hash2);
    });

    it('should never return the plaintext password', async () => {
      const plaintext = 'TestPassword1!';
      const hash = await service.hash(plaintext);
      expect(hash).not.toContain(plaintext);
    });

    it('should handle passwords with special characters', async () => {
      const specialPw = '!@#$%^&*()_+<>?:{}|~`-=[]\\;\',./"';
      const hash = await service.hash(specialPw);
      expect(hash).toMatch(/^\$argon2id\$/);
    });
  });

  // ── verify() ─────────────────────────────────────────────────────────────────

  describe('verify()', () => {
    it('should return true for a correct password', async () => {
      const password = 'CorrectPassword1!';
      const hash = await service.hash(password);
      const result = await service.verify(password, hash);
      expect(result).toBe(true);
    });

    it('should return false for an incorrect password', async () => {
      const hash = await service.hash('CorrectPassword1!');
      const result = await service.verify('WrongPassword1!', hash);
      expect(result).toBe(false);
    });

    it('should return false for an empty password', async () => {
      const hash = await service.hash('CorrectPassword1!');
      const result = await service.verify('', hash);
      expect(result).toBe(false);
    });

    it('should return false (not throw) for a malformed hash', async () => {
      const result = await service.verify('TestPassword1!', 'not-a-valid-argon2-hash');
      expect(result).toBe(false);
    });

    it('should return false if pepper differs (simulates pepper rotation)', async () => {
      // Hash with original pepper
      const hash = await service.hash('TestPassword1!');

      // Create service with different pepper
      const differentPepperConfig = { ...mockAuthConfig, argon2Pepper: 'a-completely-different-pepper-value-here' };
      const serviceWithDifferentPepper = new PasswordService(differentPepperConfig as AuthConfig);

      // Verification should fail — pepper mismatch
      const result = await serviceWithDifferentPepper.verify('TestPassword1!', hash);
      expect(result).toBe(false);
    });
  });

  // ── validateStrength() ───────────────────────────────────────────────────────

  describe('validateStrength()', () => {
    it('should return valid for a strong password', () => {
      const result = service.validateStrength('StrongPass1!');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.score).toBe(4);
    });

    it('should reject passwords shorter than 8 characters', () => {
      const result = service.validateStrength('Short1!');
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('8 characters'))).toBe(true);
    });

    it('should reject passwords without uppercase', () => {
      const result = service.validateStrength('nouppercase1!');
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('uppercase'))).toBe(true);
    });

    it('should reject passwords without numbers', () => {
      const result = service.validateStrength('NoNumbers!!');
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('number'))).toBe(true);
    });

    it('should reject passwords without special characters', () => {
      const result = service.validateStrength('NoSpecial1234');
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('special'))).toBe(true);
    });

    it('should reject passwords exceeding 128 characters', () => {
      const longPassword = 'A1!' + 'a'.repeat(130);
      const result = service.validateStrength(longPassword);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('128 characters'))).toBe(true);
    });

    it('should accumulate multiple errors', () => {
      const result = service.validateStrength('weak');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });
});
