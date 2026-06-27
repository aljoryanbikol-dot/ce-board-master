/**
 * CacheService — Type-safe, namespaced cache operations.
 *
 * Wraps @nestjs/cache-manager with:
 * - Namespaced keys (prevents collisions between modules)
 * - Typed get/set methods
 * - JSON serialization/deserialization
 * - Structured logging on cache misses
 * - Atomic operations via the underlying Redis client
 *
 * Cache key namespaces (defined as constants to prevent typos):
 * - taxonomy: subjects, topics, subtopics (24h TTL)
 * - readiness: per-user readiness scores (5min TTL)
 * - roles: role-permission mappings (24h TTL)
 * - tokens: refresh token hash → user mapping (token TTL)
 * - ratelimit: per-user, per-IP counters (sliding window TTL)
 *
 * @injectable
 */
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';

/** Cache TTL constants in seconds */
export const CacheTTL = {
  /** Taxonomy: subjects, topics, subtopics rarely change */
  TAXONOMY: 86_400, // 24 hours
  /** Role-permission mappings: invalidated on role change */
  ROLES: 86_400, // 24 hours
  /** User readiness score: updated asynchronously after each session */
  READINESS: 300, // 5 minutes
  /** Question bank metadata: invalidated on admin publish */
  QUESTIONS: 300, // 5 minutes
  /** Formula library: all formulas in one key */
  FORMULAS: 3_600, // 1 hour
  /** Search autocomplete results */
  SEARCH_AUTOCOMPLETE: 60, // 1 minute
  /** Session tokens: inherit the token's own expiry */
  TOKENS: 2_592_000, // 30 days (max, actual expiry set per token)
  /** User records: invalidated on user update/delete */
  USERS: 300, // 5 minutes
  /** User profiles: invalidated on profile update */
  PROFILES: 300, // 5 minutes
  /** Subscription plans: rarely change */
  PLANS: 3_600, // 1 hour
  /** Active subscription per user */
  SUBSCRIPTIONS: 300, // 5 minutes
  /** Admin CMS dashboard aggregates: short-lived, refreshed frequently */
  DASHBOARD: 30, // 30 seconds
  /** Knowledge base entities: authoritative, change rarely once published */
  KNOWLEDGE: 3_600, // 1 hour
  /** AI generation context: derived from published KB, safe to cache briefly */
  AI_GENERATION: 300, // 5 minutes
  /** Student dashboard/progress: personal, changes often, short TTL */
  STUDENT: 60, // 1 minute
  /** Exam session state: live during an attempt, short TTL for autosave/resume */
  EXAM: 30, // 30 seconds
  /** Tutor conversation context/memory: short-lived, regenerated as a thread grows */
  TUTOR: 120, // 2 minutes
} as const;

/** Cache namespace prefixes */
export const CacheNamespace = {
  TAXONOMY: 'taxonomy',
  ROLES: 'roles',
  READINESS: 'readiness',
  QUESTIONS: 'questions',
  FORMULAS: 'formulas',
  SEARCH: 'search',
  TOKENS: 'tokens',
  AI_QUOTA: 'ai_quota',
  RATE_LIMIT: 'rate_limit',
  SESSIONS: 'sessions',
  USERS: 'users',
  PROFILES: 'profiles',
  PLANS: 'plans',
  SUBSCRIPTIONS: 'subscriptions',
  DASHBOARD: 'dashboard',
  KNOWLEDGE: 'knowledge',
  AI_GENERATION: 'ai_generation',
  STUDENT: 'student',
  EXAM: 'exam',
  TUTOR: 'tutor',
} as const;

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  /**
   * Build a namespaced cache key to prevent collisions.
   * Format: namespace:identifier[:subidentifier]
   */
  buildKey(namespace: string, ...parts: (string | number)[]): string {
    return `${namespace}:${parts.join(':')}`;
  }

  /**
   * Get a cached value with automatic JSON deserialization.
   * Returns null on cache miss (never throws).
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.cache.get<string>(key);
      if (value === undefined || value === null) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.warn(`Cache get error for key "${key}":`, error);
      return null;
    }
  }

  /**
   * Set a cache value with automatic JSON serialization.
   * TTL is in seconds.
   */
  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.cache.set(key, JSON.stringify(value), ttlSeconds * 1000);
    } catch (error) {
      this.logger.warn(`Cache set error for key "${key}":`, error);
      // Cache failures are non-fatal — the application continues without cache
    }
  }

  /**
   * Delete a cache entry.
   */
  async del(key: string): Promise<void> {
    try {
      await this.cache.del(key);
    } catch (error) {
      this.logger.warn(`Cache delete error for key "${key}":`, error);
    }
  }

  /**
   * Delete all cache entries matching a pattern.
   * Uses Redis SCAN to avoid blocking operations.
   * Example: invalidatePattern('taxonomy:*') clears all taxonomy cache.
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      // Access the underlying Redis client via the store
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const store = (this.cache as any).stores?.[0]?.client;
      if (!store) {
        this.logger.warn('Cannot access Redis client for pattern invalidation');
        return;
      }

      let cursor = '0';
      let deleted = 0;

      do {
        const [nextCursor, keys] = await store.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;

        if (keys.length > 0) {
          await store.del(...keys);
          deleted += keys.length;
        }
      } while (cursor !== '0');

      if (deleted > 0) {
        this.logger.debug(`Invalidated ${deleted} cache keys matching "${pattern}"`);
      }
    } catch (error) {
      this.logger.warn(`Cache pattern invalidation error for "${pattern}":`, error);
    }
  }

  /**
   * Get-or-set pattern: returns cached value or calls factory to populate cache.
   * This is the most common caching pattern in CE Board Master.
   *
   * @example
   * const subjects = await cacheService.remember(
   *   cacheService.buildKey(CacheNamespace.TAXONOMY, 'subjects'),
   *   CacheTTL.TAXONOMY,
   *   () => prisma.subject.findMany({ where: { isActive: true } })
   * );
   */
  async remember<T>(key: string, ttlSeconds: number, factory: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }
}
