/**
 * QueueModule — BullMQ-powered background job processing.
 *
 * Architecture decisions (ADR-007):
 * - All async operations (email, analytics, AI content generation) are
 *   processed via BullMQ queues to keep the request path fast.
 * - Queues use Redis DB 1 (isolated from the cache DB 0).
 * - Each queue has its own concurrency, retry, and backoff settings.
 * - Processors are co-located with their domain modules (e.g.,
 *   NotificationsModule registers the email processor).
 *
 * Queue inventory:
 * - email: Transactional email delivery via Resend
 * - analytics: User answer event processing and metric aggregation
 * - ai-content: AI content generation for question hints/explanations
 * - notifications: Push notification delivery (Phase 3)
 *
 * @module QueueModule
 */
import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { AppEnvironment } from '@/config/configuration';

/** Named queues — use these constants throughout the application */
export const QUEUE_NAMES = {
  EMAIL: 'email',
  ANALYTICS: 'analytics',
  AI_CONTENT: 'ai-content',
  NOTIFICATIONS: 'notifications',
} as const;

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService<AppEnvironment>) => ({
        connection: {
          host: config.get('REDIS_HOST', { infer: true }),
          port: config.get('REDIS_PORT', { infer: true }),
          password: config.get('REDIS_PASSWORD', { infer: true }) || undefined,
          db: config.get('REDIS_DB_QUEUE', { infer: true }),
          tls: config.get('REDIS_TLS', { infer: true }) ? {} : undefined,
          // Retry strategy: exponential backoff up to 30 seconds
          retryStrategy: (times: number) => Math.min(times * 1000, 30_000),
        },
        defaultJobOptions: {
          // Jobs are removed from Redis after completion to prevent memory bloat
          removeOnComplete: { count: 1000, age: 3600 },
          removeOnFail: { count: 5000, age: 86400 },
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      }),
      inject: [ConfigService],
    }),
    // Register all queues
    BullModule.registerQueue(
      { name: QUEUE_NAMES.EMAIL },
      { name: QUEUE_NAMES.ANALYTICS },
      { name: QUEUE_NAMES.AI_CONTENT },
      { name: QUEUE_NAMES.NOTIFICATIONS },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
