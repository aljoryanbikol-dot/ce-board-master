import { describe, it, expect } from 'vitest';
import { loginSchema, registerSchema, resetPasswordSchema, mfaSchema } from '@/features/auth/schemas';

describe('loginSchema', () => {
  it('accepts a valid login', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true);
  });
  it('rejects an invalid email', () => {
    expect(loginSchema.safeParse({ email: 'nope', password: 'x' }).success).toBe(false);
  });
});

describe('registerSchema', () => {
  it('enforces password strength', () => {
    const weak = registerSchema.safeParse({ fullName: 'Jane Doe', email: 'a@b.com', password: 'alllower1', confirmPassword: 'alllower1' });
    expect(weak.success).toBe(false); // missing uppercase
  });
  it('requires matching passwords', () => {
    const res = registerSchema.safeParse({ fullName: 'Jane Doe', email: 'a@b.com', password: 'Strong123', confirmPassword: 'Different1' });
    expect(res.success).toBe(false);
  });
  it('accepts a strong, matching registration', () => {
    const res = registerSchema.safeParse({ fullName: 'Jane Doe', email: 'a@b.com', password: 'Strong123', confirmPassword: 'Strong123' });
    expect(res.success).toBe(true);
  });
});

describe('resetPasswordSchema', () => {
  it('requires matching new passwords', () => {
    expect(resetPasswordSchema.safeParse({ password: 'Strong123', confirmPassword: 'Nope12345' }).success).toBe(false);
  });
});

describe('mfaSchema', () => {
  it('requires exactly 6 digits', () => {
    expect(mfaSchema.safeParse({ code: '123456' }).success).toBe(true);
    expect(mfaSchema.safeParse({ code: '12ab56' }).success).toBe(false);
    expect(mfaSchema.safeParse({ code: '123' }).success).toBe(false);
  });
});
