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
import { CacheService } from './cache.service';
import type { AppEnvironment } from '@/config/configuration';

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

        const scheme = tls ? 'rediss' : 'redis';
        const redisUrl = password
          ? `${scheme}://:${password}@${host}:${port}/${db}`
          : `${scheme}://${host}:${port}/${db}`;

        return {
          stores: [
createKeyv(redisUrl),
          ],
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
