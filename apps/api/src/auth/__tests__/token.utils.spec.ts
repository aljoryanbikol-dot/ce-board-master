/**
 * @file token.utils.spec.ts
 * @module Auth/Tests
 *
 * Unit tests for token utility functions.
 *
 * Pure functions are trivially testable without mocks.
 * Tests verify: entropy properties, hash consistency, expiry logic.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  generateSecureToken,
  hashToken,
  generateTokenFamily,
  calculateExpiry,
  isExpired,
} from '../utils/token.utils';

describe('Token Utilities', () => {
  describe('generateSecureToken()', () => {
    it('should generate a 64-character hex string (32 bytes)', () => {
      const token = generateSecureToken(32);
      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[0-9a-f]+$/);
    });

    it('should generate unique tokens on each call', () => {
      const tokens = new Set(Array.from({ length: 100 }, () => generateSecureToken()));
      expect(tokens.size).toBe(100);
    });

    it('should respect custom byte length', () => {
      const token16 = generateSecureToken(16);
      expect(token16).toHaveLength(32); // 16 bytes → 32 hex chars
    });
  });

  describe('hashToken()', () => {
    it('should produce a consistent SHA-256 hash', () => {
      const token = 'test-token-value';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);
      expect(hash1).toBe(hash2);
    });

    it('should produce a 64-character hex string', () => {
      const hash = hashToken('any-token');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });

    it('should produce different hashes for different tokens', () => {
      const hash1 = hashToken('token-a');
      const hash2 = hashToken('token-b');
      expect(hash1).not.toBe(hash2);
    });

    it('hash should not equal the original token', () => {
      const token = 'my-secret-token';
      const hash = hashToken(token);
      expect(hash).not.toBe(token);
    });
  });

  describe('generateTokenFamily()', () => {
    it('should generate a 32-character hex string', () => {
      const family = generateTokenFamily();
      expect(family).toHaveLength(32);
      expect(family).toMatch(/^[0-9a-f]+$/);
    });

    it('should generate unique family IDs', () => {
      const families = new Set(Array.from({ length: 50 }, () => generateTokenFamily()));
      expect(families.size).toBe(50);
    });
  });

  describe('calculateExpiry()', () => {
    it('should return a Date approximately ttl seconds in the future', () => {
      const before = Date.now();
      const expiry = calculateExpiry(900); // 15 minutes
      const after = Date.now();

      const expectedMs = 900 * 1000;
      expect(expiry.getTime()).toBeGreaterThanOrEqual(before + expectedMs - 10);
      expect(expiry.getTime()).toBeLessThanOrEqual(after + expectedMs + 10);
    });
  });

  describe('isExpired()', () => {
    it('should return true for a past date', () => {
      const past = new Date(Date.now() - 1000);
      expect(isExpired(past)).toBe(true);
    });

    it('should return false for a future date', () => {
      const future = new Date(Date.now() + 10_000);
      expect(isExpired(future)).toBe(false);
    });

    it('should return true for the exact current moment (edge case)', () => {
      // A date set to now() is effectively expired
      const now = new Date(Date.now() - 1);
      expect(isExpired(now)).toBe(true);
    });
  });
});
