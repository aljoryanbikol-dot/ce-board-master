/**
 * CacheModule — Global Redis-backed cache for CE Board Master.
 *
 * Architecture decisions (ADR-006):
 * - Uses cache-manager (v6) with the @keyv/redis store (Keyv v5).
 * - Three Redis databases for isolation:
 *   DB 0: General cache (taxonomy, question metadata, readiness scores)
 *   DB 1: BullMQ queues (see QueueModule)
 *   DB 2: Session/token data (refresh token hashes, rate limit counters)
 * - TTLs are defined per-use-case, not globally.
 * - The CacheService wrapper provides type-safe, namespaced cache operations.
 *
 * @module CacheModule
 */
import { Global, Module } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createKeyv } from '@keyv/redis';
import Keyv from 'keyv';
import { Logger } from '@nestjs/common';
import { CacheService } from './cache.service';
import type { AppEnvironment } from '../config/configuration';

@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      isGlobal: true,
      useFactory: (config: ConfigService<AppEnvironment>) => {
        const host = config.get('REDIS_HOST', { infer: true });
        const port = config.get('REDIS_PORT', { infer: true });
        const password = config.get('REDIS_PASSWORD', { infer: true });
        const db = config.get('REDIS_DB_CACHE', { infer: true });
        const tls = config.get('REDIS_TLS', { infer: true });

        // Cache is an optimisation, never a dependency. A managed Redis can
        // lose its credentials or hit a plan quota at any time, and pointing
        // the store at an unreachable server made every cached read throw —
        // taking pages like the exam list down with it. When Redis is not
        // fully configured, fall back to an in-process store: slower across
        // instances, but the platform keeps serving.
        const hasRedis = Boolean(host && password);
        if (!hasRedis) {
          new Logger('CacheModule').warn(
            'Redis is not fully configured (host/password) — using an in-memory cache. ' +
            'Set REDIS_HOST and REDIS_PASSWORD to restore the shared cache.',
          );
          return {
            stores: [new Keyv()],
            ttl: config.get('REDIS_DEFAULT_TTL', { infer: true })! * 1000,
          };
        }

        const scheme = tls ? 'rediss' : 'redis';
        const redisUrl = `${scheme}://:${password}@${host}:${port}/${db}`;

        return {
          stores: [createKeyv(redisUrl)],
          ttl: config.get('REDIS_DEFAULT_TTL', { infer: true })! * 1000,
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [CacheService],
  exports: [CacheService, NestCacheModule],
})
export class CacheModule {}
