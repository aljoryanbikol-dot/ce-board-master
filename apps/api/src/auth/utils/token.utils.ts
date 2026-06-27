/**
 * @file token.utils.ts
 * @module Auth/Utils
 *
 * Pure utility functions for token generation and hashing.
 *
 * Design principles:
 * - Pure functions only — no side effects, no dependencies
 * - Suitable for unit testing without mocks
 * - Cryptographically secure random generation via Node.js `crypto` module
 *
 * Security note (Project Constitution Article XI §11):
 * Raw tokens are NEVER stored. Only the SHA-256 hash is persisted in the
 * `user_auth_tokens` table. The raw token is given to the client once and
 * discarded from server memory. This ensures a database breach cannot be
 * used to hijack active sessions.
 */
import { createHash, randomBytes } from 'node:crypto';
import {
  TOKEN_HASH_ALGORITHM,
  TOKEN_HASH_ENCODING,
} from '../auth.constants';

/**
 * Generate a cryptographically secure random token.
 *
 * Uses Node.js `crypto.randomBytes()` which reads from the OS entropy pool.
 * The resulting token has 256 bits of entropy (32 bytes → 64 hex chars).
 *
 * @param byteLength - Number of random bytes (default: 32 → 256-bit token)
 * @returns Hex-encoded random string
 */
export function generateSecureToken(byteLength = 32): string {
  return randomBytes(byteLength).toString('hex');
}

/**
 * Hash a raw token with SHA-256 for safe database storage.
 *
 * The same raw token always produces the same hash, enabling lookup.
 * SHA-256 is appropriate here because:
 * - Tokens are already high-entropy (256-bit random) — pre-image attacks
 *   are computationally infeasible
 * - We need fast lookup (not slow hashing like Argon2)
 * - Unlike passwords, tokens don't need work-factor hardening
 *
 * @param rawToken - The raw token to hash
 * @returns Hex-encoded SHA-256 hash
 */
export function hashToken(rawToken: string): string {
  return createHash(TOKEN_HASH_ALGORITHM).update(rawToken).digest(TOKEN_HASH_ENCODING);
}

/**
 * Generate a token family identifier for refresh token rotation.
 *
 * A token family groups all refresh tokens issued from the same login session.
 * If a refresh token is used twice (reuse detection), the entire family is
 * revoked — logging out the user from that device.
 *
 * @returns A UUID-format family identifier
 */
export function generateTokenFamily(): string {
  // Generate 16 bytes → UUID-like format (without dashes for DB storage)
  const bytes = randomBytes(16);
  return bytes.toString('hex');
}

/**
 * Calculate the expiry Date for a token given its TTL.
 * @param ttlSeconds - Time-to-live in seconds
 * @returns Date object representing the exact expiry moment
 */
export function calculateExpiry(ttlSeconds: number): Date {
  return new Date(Date.now() + ttlSeconds * 1000);
}

/**
 * Check if a Date is in the past (i.e., a token has expired).
 * @param expiresAt - The expiry date to check
 * @returns true if the date is in the past
 */
export function isExpired(expiresAt: Date): boolean {
  return expiresAt.getTime() < Date.now();
}
