/**
 * @file users.module.ts
 * @module Users
 *
 * UsersModule — admin user management (Sprint 2.4).
 *
 * Integrates with:
 * - AuthModule  → RolesGuard, JwtAuthGuard (global), AuthenticatedUser
 * - RbacModule  → PermissionGuard, UserRoleService (ownership + permission checks)
 * - DatabaseModule, CacheModule → @Global(), no explicit import
 * - EventEmitter2 → registered globally in AppModule
 *
 * Exports UsersService for use by future modules (AdminModule, AnalyticsModule).
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { UsersService } from './services/users.service';
import { UsersController } from './controllers/users.controller';

@Module({
  imports: [
    AuthModule, // RolesGuard, auth context
    RbacModule, // PermissionGuard, UserRoleService
  ],
  controllers: [UsersController],
  providers:   [UsersService],
  exports:     [UsersService],
})
export class UsersModule {}
