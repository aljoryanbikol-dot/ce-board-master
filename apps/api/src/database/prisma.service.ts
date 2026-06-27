/**
 * PrismaService — Primary database client.
 *
 * Connects to the primary PostgreSQL instance (via PgBouncer in production).
 * Used for all write operations and non-analytics reads.
 *
 * Soft-delete filtering: All queries automatically exclude rows where
 * deleted_at IS NOT NULL via Prisma middleware. This implements the
 * soft-delete pattern defined in the Database Architecture (Phase 2).
 *
 * @injectable
 */
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import type { AppEnvironment } from '@/config/configuration';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly config: ConfigService<AppEnvironment>) {
    const isDevelopment = config.get('NODE_ENV', { infer: true }) === 'development';

    super({
      datasources: {
        db: {
          url: config.get('DATABASE_POOL_URL', { infer: true }),
        },
      },
      log: isDevelopment
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'warn' },
            { emit: 'event', level: 'error' },
          ]
        : [
            { emit: 'event', level: 'warn' },
            { emit: 'event', level: 'error' },
          ],
    });

    // Register soft-delete middleware
    this.$use(async (params, next) => {
      // Automatically filter deleted records from all find operations
      const softDeleteModels = [
        'User',
        'Question',
        'Subject',
        'Topic',
        'Subtopic',
        'Tag',
        'ReferenceBook',
        'EngineeringCode',
        'FormulaLibrary',
      ];

      if (softDeleteModels.includes(params.model ?? '')) {
        if (params.action === 'findUnique' || params.action === 'findFirst') {
          params.action = 'findFirst';
          params.args.where = {
            ...params.args.where,
            deletedAt: null,
          };
        }

        if (params.action === 'findMany') {
          if (!params.args) params.args = {};
          if (!params.args.where) params.args.where = {};
          params.args.where.deletedAt = null;
        }
      }

      return next(params);
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('✅ Primary database connection established');

      // Development query logging
      if (this.config.get('NODE_ENV', { infer: true }) === 'development') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this as any).$on('query', (event: { query: string; duration: number }) => {
          if (event.duration > 100) {
            this.logger.warn(
              `Slow query detected (${event.duration}ms): ${event.query.substring(0, 100)}`,
            );
          }
        });
      }
    } catch (error) {
      this.logger.error('❌ Failed to connect to primary database', error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Database connection closed');
  }

  /**
   * Execute a raw query within a transaction.
   * Prefer Prisma's built-in transaction API over this method.
   */
  async executeTransaction<T>(
    fn: (prisma: Omit<PrismaService, '$transaction' | '$connect' | '$disconnect'>) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(fn as Parameters<typeof this.$transaction>[0]);
  }
}
