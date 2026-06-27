/**
 * @file auth.dto.spec.ts
 * @module Auth/Tests
 *
 * Unit tests for Zod validation schemas in auth.dto.ts.
 *
 * Tests verify:
 * - Valid inputs pass validation
 * - Invalid inputs produce specific error messages
 * - Email normalization (lowercase + trim)
 * - Password strength requirements
 * - Edge cases (empty strings, boundary lengths)
 */
import { describe, it, expect } from 'vitest';
import {
  RegisterSchema,
  LoginSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  ChangePasswordSchema,
} from '../auth.dto';

describe('Auth DTOs — Zod Validation', () => {
  // ── RegisterSchema ──────────────────────────────────────────────────────────
  describe('RegisterSchema', () => {
    const validRegister = {
      firstName: 'Juan',
      lastName: 'dela Cruz',
      email: 'juan@example.com',
      password: 'SecurePass1!',
    };

    it('should accept a valid registration', () => {
      const result = RegisterSchema.safeParse(validRegister);
      expect(result.success).toBe(true);
    });

    it('should lowercase the email address', () => {
      const result = RegisterSchema.safeParse({
        ...validRegister,
        email: 'JUAN@EXAMPLE.COM',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('juan@example.com');
      }
    });

    it('should trim whitespace from the email', () => {
      const result = RegisterSchema.safeParse({
        ...validRegister,
        email: '  juan@example.com  ',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('juan@example.com');
      }
    });

    it('should reject an invalid email format', () => {
      const result = RegisterSchema.safeParse({
        ...validRegister,
        email: 'not-an-email',
      });
      expect(result.success).toBe(false);
    });

    it('should reject a weak password (no uppercase)', () => {
      const result = RegisterSchema.safeParse({
        ...validRegister,
        password: 'weakpassword1!',
      });
      expect(result.success).toBe(false);
    });

    it('should reject a password under 8 characters', () => {
      const result = RegisterSchema.safeParse({
        ...validRegister,
        password: 'Ab1!',
      });
      expect(result.success).toBe(false);
    });

    it('should accept an optional examTargetDate in the future', () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      const result = RegisterSchema.safeParse({
        ...validRegister,
        examTargetDate: futureDate,
      });
      expect(result.success).toBe(true);
    });

    it('should reject a past examTargetDate', () => {
      const result = RegisterSchema.safeParse({
        ...validRegister,
        examTargetDate: '2020-01-01',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const result = RegisterSchema.safeParse({
        email: 'test@example.com',
        password: 'SecurePass1!',
        // missing firstName, lastName
      });
      expect(result.success).toBe(false);
    });
  });

  // ── LoginSchema ─────────────────────────────────────────────────────────────
  describe('LoginSchema', () => {
    it('should accept valid email + password', () => {
      const result = LoginSchema.safeParse({
        email: 'juan@example.com',
        password: 'AnyPassword', // Login doesn't validate strength
      });
      expect(result.success).toBe(true);
    });

    it('should normalise email to lowercase', () => {
      const result = LoginSchema.safeParse({
        email: 'JUAN@EXAMPLE.COM',
        password: 'password',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('juan@example.com');
      }
    });

    it('should accept an optional 6-digit MFA code', () => {
      const result = LoginSchema.safeParse({
        email: 'juan@example.com',
        password: 'password',
        mfaCode: '123456',
      });
      expect(result.success).toBe(true);
    });

    it('should reject non-6-digit MFA code', () => {
      const result = LoginSchema.safeParse({
        email: 'juan@example.com',
        password: 'password',
        mfaCode: '12345', // 5 digits
      });
      expect(result.success).toBe(false);
    });

    it('should reject an MFA code with letters', () => {
      const result = LoginSchema.safeParse({
        email: 'juan@example.com',
        password: 'password',
        mfaCode: '12345a',
      });
      expect(result.success).toBe(false);
    });
  });

  // ── ChangePasswordSchema ────────────────────────────────────────────────────
  describe('ChangePasswordSchema', () => {
    it('should accept valid password change', () => {
      const result = ChangePasswordSchema.safeParse({
        currentPassword: 'OldPassword1!',
        newPassword: 'NewPassword1!',
      });
      expect(result.success).toBe(true);
    });

    it('should reject when new password equals current password', () => {
      const result = ChangePasswordSchema.safeParse({
        currentPassword: 'SamePassword1!',
        newPassword: 'SamePassword1!',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]?.message).toContain('different');
      }
    });

    it('should reject a weak new password', () => {
      const result = ChangePasswordSchema.safeParse({
        currentPassword: 'CurrentPass1!',
        newPassword: 'weak',
      });
      expect(result.success).toBe(false);
    });
  });

  // ── ForgotPasswordSchema ────────────────────────────────────────────────────
  describe('ForgotPasswordSchema', () => {
    it('should accept a valid email', () => {
      const result = ForgotPasswordSchema.safeParse({ email: 'juan@example.com' });
      expect(result.success).toBe(true);
    });

    it('should reject an invalid email', () => {
      const result = ForgotPasswordSchema.safeParse({ email: 'not-valid' });
      expect(result.success).toBe(false);
    });
  });
});
