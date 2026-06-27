/**
 * @file password.service.ts
 * @module Auth/Services
 *
 * Handles all password hashing and verification using Argon2id.
 *
 * Argon2id is the winner of the Password Hashing Competition (PHC) and
 * is recommended by OWASP for new applications. It is resistant to:
 * - GPU brute-force attacks (memory-hard)
 * - Side-channel attacks (hybrid of Argon2i and Argon2d)
 *
 * Parameters (Project Constitution Article XI §11):
 * - memoryCost: 65,536 KB (64 MB) — makes GPU attacks expensive
 * - timeCost: 3 iterations — adds computational cost
 * - parallelism: 4 threads — matches typical server core count
 *
 * Pepper: An additional server-side secret mixed into every hash.
 * If the database is breached, the pepper (from AWS Secrets Manager)
 * prevents offline cracking even with the stored hashes.
 *
 * @implements IPasswordService
 */
import { Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthConfig } from '../config/auth.config';
import { validatePasswordStrength } from '../utils/password.utils';
import type { IPasswordService, PasswordStrengthResult } from '../auth.interface';
import { AUTH } from '../../common/constants';

@Injectable()
export class PasswordService implements IPasswordService {
  private readonly logger = new Logger(PasswordService.name);

  constructor(private readonly authConfig: AuthConfig) {}

  /**
   * Hash a plain-text password with Argon2id + pepper.
   *
   * The pepper is prepended to the password before hashing. If the hash
   * database is compromised, the attacker also needs the pepper (from
   * AWS Secrets Manager) to attempt offline cracking.
   *
   * @param plaintext - Raw password from the user
   * @returns Argon2id hash string (includes embedded algorithm parameters)
   */
  async hash(plaintext: string): Promise<string> {
    const pepperedPassword = this.addPepper(plaintext);
    return argon2.hash(pepperedPassword, {
      type: argon2.argon2id,
      memoryCost: AUTH.ARGON2_MEMORY_COST,
      timeCost: AUTH.ARGON2_TIME_COST,
      parallelism: AUTH.ARGON2_PARALLELISM,
    });
  }

  /**
   * Verify a plain-text password against a stored Argon2id hash.
   *
   * This operation is intentionally slow (Argon2 parameters) and
   * timing-safe. Never short-circuit or cache the result.
   *
   * @param plaintext - Raw password from the login request
   * @param hash - The stored Argon2id hash from `users.password_hash`
   * @returns true if the password matches, false otherwise
   */
  async verify(plaintext: string, hash: string): Promise<boolean> {
    try {
      const pepperedPassword = this.addPepper(plaintext);
      return await argon2.verify(hash, pepperedPassword);
    } catch (error) {
      // argon2.verify throws on malformed hashes — treat as failure
      this.logger.warn('Password verification error (possible hash corruption)', {
        error: error instanceof Error ? error.message : 'unknown',
      });
      return false;
    }
  }

  /**
   * Validate password strength against platform requirements.
   * @param password - The password to validate
   */
  validateStrength(password: string): PasswordStrengthResult {
    return validatePasswordStrength(password);
  }

  /** Prepend the pepper secret before hashing. @private */
  private addPepper(plaintext: string): string {
    return `${this.authConfig.argon2Pepper}:${plaintext}`;
  }
}
