/**
 * @file rbac.module.ts
 * @module Rbac
 *
 * RbacModule — Enterprise Role-Based Access Control.
 *
 * Sprint 2.3. Integrates with Sprint 2.2 AuthModule:
 * - Imports AuthModule to access RolesGuard and AuthService
 * - PermissionGuard delegates permission loading via CacheService + PrismaService
 * - UserRoleService publishes events via EventEmitter2 (registered in AppModule)
 *
 * Exports:
 * - PermissionGuard  → use in any module for permission-level enforcement
 * - RolesService     → use in AdminModule for role audit/display
 * - UserRoleService  → use in UsersModule for ownership validation
 */
import { Module } from '@nestjs/common';
import { AuthModule }            from '../auth/auth.module';
import { RolesService }          from './services/roles.service';
import { PermissionsService }    from './services/permissions.service';
import { UserRoleService }       from './services/user-role.service';
import { PermissionGuard }       from './guards/permission.guard';
import { RolesController }       from './controllers/roles.controller';
import {
  PermissionsController,
  UserRolesController,
  RbacSelfController,
} from './controllers/permissions.controller';

@Module({
  imports: [
    // AuthModule provides: RolesGuard, JwtAuthGuard (via APP_GUARD), AuthService
    // DatabaseModule and CacheModule are @Global() — no explicit import needed
    AuthModule,
  ],

  controllers: [
    RolesController,
    PermissionsController,
    UserRolesController,
    RbacSelfController,
  ],

  providers: [
    RolesService,
    PermissionsService,
    UserRoleService,
    PermissionGuard,
  ],

  exports: [
    // Exported for use in future modules:
    PermissionGuard,   // AdminModule, QuestionsModule, AiTutorModule, etc.
    RolesService,      // AdminModule for role display
    UserRoleService,   // UsersModule for ownership validation
    PermissionsService,// AdminModule for permission management UI
  ],
})
export class RbacModule {}
