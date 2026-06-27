/**
 * @file profiles.module.ts
 * @module Profiles
 *
 * ProfileModule — self-service profile management (Sprint 2.4).
 *
 * Integrates with AuthModule (RolesGuard) and RbacModule (PermissionGuard).
 * DatabaseModule, CacheModule are @Global(). EventEmitter2 from AppModule.
 *
 * Exports ProfileService for use by future modules (e.g. NotificationsModule
 * reading notification preferences, DashboardModule reading study goals).
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { ProfileService } from './services/profiles.service';
import { ProfileController } from './controllers/profiles.controller';

@Module({
  imports:     [AuthModule, RbacModule],
  controllers: [ProfileController],
  providers:   [ProfileService],
  exports:     [ProfileService],
})
export class ProfileModule {}
