/**
 * @file password.utils.ts
 * @module Auth/Utils
 *
 * Pure utility functions for password validation.
 *
 * Password strength checking is extracted here so it can be:
 * - Tested independently of the PasswordService class
 * - Reused in Zod schema refinements
 * - Shared across register and password-change flows
 *
 * Requirements (Project Constitution Article XI §11, API Contract §1):
 * - Minimum 8 characters
 * - Maximum 128 characters (DoS protection against slow Argon2 hashing)
 * - At least 1 uppercase letter
 * - At least 1 digit
 * - At least 1 special character (non-alphanumeric)
 */

export interface PasswordStrengthResult {
  isValid: boolean;
  errors: string[];
  score: number; // 0–4 (0=terrible, 4=strong)
}

/**
 * Validate password strength against CE Board Master requirements.
 *
 * Returns structured errors rather than throwing — allows the caller to
 * decide whether to throw an exception or return a validation error response.
 *
 * @param password - The plain-text password to validate
 * @returns Validation result with isValid flag, error messages, and score
 */
export function validatePasswordStrength(password: string): PasswordStrengthResult {
  const errors: string[] = [];
  let score = 0;

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters.');
  } else {
    score++;
  }

  if (password.length > 128) {
    errors.push('Password must not exceed 128 characters.');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter.');
  } else {
    score++;
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number.');
  } else {
    score++;
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character.');
  } else {
    score++;
  }

  return {
    isValid: errors.length === 0,
    errors,
    score,
  };
}

/**
 * Check if two passwords are identical (for new ≠ old password validation).
 * Uses a timing-safe comparison to prevent timing attacks.
 *
 * Note: This is NOT a security-critical comparison (passwords are not hashed
 * at this point) — it's a simple UX check. The timing-safe aspect is a
 * belt-and-suspenders measure.
 */
export function isSamePassword(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    // XOR: 0 if same char, non-zero if different
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
