/**
 * AnalyticsPrismaService — Read-replica database client for analytics.
 *
 * Routes heavy analytics queries (heatmaps, trend calculations, report
 * generation) to the PostgreSQL read replica, keeping the primary
 * instance free for write operations and fast student-facing queries.
 *
 * In development, this points to the same database as PrismaService.
 * In production, it connects to the RDS read replica via PgBouncer.
 *
 * Used exclusively by: AnalyticsModule, AdaptiveModule, AdminReportsModule.
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
export class AnalyticsPrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AnalyticsPrismaService.name);

  constructor(private readonly config: ConfigService<AppEnvironment>) {
    super({
      datasources: {
        db: {
          url: config.get('DATABASE_ANALYTICS_URL', { infer: true }),
        },
      },
      log: [
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('✅ Analytics (read replica) connection established');
    } catch (error) {
      this.logger.error('❌ Failed to connect to analytics database', error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Analytics database connection closed');
  }
}
