/**
 * @file dashboard.module.ts
 * @module Dashboard
 *
 * DashboardModule — the Admin CMS dashboard (Sprint 2.7). Composes
 * CmsModule's analytics engine into the dashboard views and queues. Kept as a
 * separate module so dashboard concerns can evolve independently of the CMS
 * write-side.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { CmsModule } from '../cms/cms.module';
import { DashboardController } from './controllers/dashboard.controller';
import { DashboardService } from './services/dashboard.service';

@Module({
  imports: [AuthModule, RbacModule, CmsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
