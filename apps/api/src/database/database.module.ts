/**
 * DatabaseModule — Provides the Prisma client as a global singleton.
 *
 * Architecture decisions (ADR-005):
 * - PrismaService extends PrismaClient and implements OnModuleInit/OnModuleDestroy
 *   to manage connection lifecycle properly.
 * - A separate analytics PrismaService connects to the read replica to route
 *   heavy analytics queries away from the primary database.
 * - Connection pooling is handled externally via PgBouncer (production).
 *   The application connects to PgBouncer, not directly to RDS.
 *
 * @module DatabaseModule
 */
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AnalyticsPrismaService } from './analytics-prisma.service';

@Global()
@Module({
  providers: [PrismaService, AnalyticsPrismaService],
  exports: [PrismaService, AnalyticsPrismaService],
})
export class DatabaseModule {}
