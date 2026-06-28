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
import { Prisma, PrismaClient } from '@prisma/client';
import type { AppEnvironment } from '@/config/configuration';

/**
 * Models that implement the soft-delete pattern (a nullable `deletedAt`
 * timestamp). Reads on these models exclude rows where `deletedAt IS NOT NULL`.
 */
const SOFT_DELETE_MODELS: ReadonlySet<string> = new Set([
  'User',
  'Question',
  'Subject',
  'Topic',
  'Subtopic',
  'Tag',
  'ReferenceBook',
  'EngineeringCode',
  'FormulaLibrary',
]);

/** Minimal structural view of a `where` clause we can augment. */
type WhereArgs = { where?: Record<string, unknown> };

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

    // Prisma 5 removed the `$use` middleware API; soft-delete filtering is now
    // applied through a client extension. Returning the extended client from the
    // constructor makes every injected `PrismaService` transparently apply it.
    return this.withSoftDelete();
  }

  /**
   * Apply the soft-delete query extension. `findFirst`/`findMany` on soft-delete
   * models gain a `deletedAt: null` filter; `findUnique` results that resolve to
   * a soft-deleted row are treated as not found — mirroring the previous
   * middleware behaviour.
   */
  private withSoftDelete(): this {
    const extended = this.$extends({
      query: {
        $allModels: {
          findFirst({ model, args, query }) {
            if (SOFT_DELETE_MODELS.has(model)) {
              const a = args as WhereArgs;
              a.where = { ...a.where, deletedAt: null };
            }
            return query(args);
          },
          findMany({ model, args, query }) {
            if (SOFT_DELETE_MODELS.has(model)) {
              const a = args as WhereArgs;
              a.where = { ...a.where, deletedAt: null };
            }
            return query(args);
          },
          async findUnique({ model, args, query }) {
            const result = await query(args);
            if (SOFT_DELETE_MODELS.has(model) && result !== null) {
              const row = result as { deletedAt?: Date | null };
              if (row.deletedAt != null) return null;
            }
            return result;
          },
        },
      },
    });

    return extended as unknown as this;
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('✅ Primary database connection established');

      // Development query logging. The base `PrismaClient` type does not narrow
      // `$on` to the `query` event unless the log options are captured as a type
      // argument, so we project a precise structural signature here.
      if (this.config.get('NODE_ENV', { infer: true }) === 'development') {
        const queryLogger = this as unknown as {
          $on(event: 'query', listener: (event: Prisma.QueryEvent) => void): void;
        };
        queryLogger.$on('query', (event) => {
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
   * Run a set of operations inside an interactive transaction.
   * Prefer Prisma's built-in transaction API directly where possible.
   */
  async executeTransaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(fn);
  }
}
