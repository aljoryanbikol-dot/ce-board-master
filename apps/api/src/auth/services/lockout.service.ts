/**
 * @file lockout.service.ts
 * @module Auth/Services
 *
 * Account lockout enforcement via Redis sliding-window counters.
 *
 * Security spec (Project Constitution Article XI §11):
 * - 5 consecutive failures within 15 minutes triggers a 15-minute lockout
 * - Per-user lockout (by userId) for known accounts
 * - Per-IP lockout (by IP) for unknown email attempts (anti-enumeration)
 * - All lockout events are logged to the login_attempts table (immutable)
 * - Lockout is lifted automatically when the Redis key expires
 *
 * Redis keys:
 *   auth:lockout:{userId}    — per-user failure counter (TTL: 15 min)
 *   auth:ip_attempts:{ip}    — per-IP failure counter  (TTL: 15 min)
 *
 * This service is intentionally stateless (pure Redis) so that multiple
 * ECS tasks share the same counters automatically.
 */
import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../cache/cache.service';
import { LOCKOUT_KEY_PREFIX, IP_LOCKOUT_KEY_PREFIX } from '../auth.constants';
import { AUTH } from '../../common/constants';

export interface LockoutStatus {
  isLocked: boolean;
  /** Remaining lockout seconds (0 if not locked) */
  remainingSeconds: number;
  /** Current failure count */
  failureCount: number;
}

@Injectable()
export class LockoutService {
  private readonly logger = new Logger(LockoutService.name);

  constructor(private readonly cache: CacheService) {}

  /**
   * Record a failed login attempt and check if the account should be locked.
   * Increments the Redis counter and sets/extends the TTL.
   *
   * @param userId - Known user's UUID (undefined for unknown emails)
   * @param ipAddress - Client IP address
   * @returns Whether the account is now locked after this failure
   */
  async recordFailure(userId: string | undefined, ipAddress: string): Promise<boolean> {
    const promises: Promise<number>[] = [];

    if (userId) {
      promises.push(this.incrementCounter(LOCKOUT_KEY_PREFIX + userId));
    }
    promises.push(this.incrementCounter(IP_LOCKOUT_KEY_PREFIX + ipAddress));

    const counts = await Promise.all(promises);
    const userCount = userId ? counts[0] : 0;
    const ipCount = counts[counts.length - 1];

    const isLocked =
      (userId && (userCount ?? 0) >= AUTH.MAX_FAILED_ATTEMPTS) ||
      ipCount >= AUTH.MAX_FAILED_ATTEMPTS * 3; // IP threshold is 3x higher

    if (isLocked) {
      this.logger.warn({
        message: 'Account lockout triggered',
        userId,
        ipAddress,
        userCount,
        ipCount,
      });
    }

    return isLocked;
  }

  /**
   * Check lockout status without modifying counters.
   * Called before password verification to fail fast.
   */
  async getLockoutStatus(userId: string, ipAddress: string): Promise<LockoutStatus> {
    const [userCount, ipCount] = await Promise.all([
      this.getCounter(LOCKOUT_KEY_PREFIX + userId),
      this.getCounter(IP_LOCKOUT_KEY_PREFIX + ipAddress),
    ]);

    const isLocked =
      userCount >= AUTH.MAX_FAILED_ATTEMPTS ||
      ipCount >= AUTH.MAX_FAILED_ATTEMPTS * 3;

    return {
      isLocked,
      remainingSeconds: isLocked ? AUTH.LOCKOUT_DURATION : 0,
      failureCount: Math.max(userCount, 0),
    };
  }

  /**
   * Clear the lockout counter for a user on successful login.
   * Prevents legitimate users from being locked out after password changes.
   */
  async clearLockout(userId: string): Promise<void> {
    await this.cache.del(LOCKOUT_KEY_PREFIX + userId);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Increment a Redis counter and set TTL if it's the first failure.
   * Returns the new counter value.
   */
  private async incrementCounter(key: string): Promise<number> {
    // Get current value first
    const current = await this.getCounter(key);
    const newValue = current + 1;
    // Set with TTL (overwrites existing, extends window)
    await this.cache.set(key, newValue, AUTH.FAILED_ATTEMPTS_WINDOW);
    return newValue;
  }

  private async getCounter(key: string): Promise<number> {
    const value = await this.cache.get<number>(key);
    return value ?? 0;
  }
}
