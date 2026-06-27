/**
 * @file permissions.controller.ts
 * @module Rbac/Controllers
 *
 * PermissionsController — Admin CRUD for the permissions catalog.
 *
 * All endpoints require:
 * - JWT authentication (JwtAuthGuard, global APP_GUARD)
 * - Role: super_admin (RolesGuard — only super_admin can manage permissions)
 * - Permission: permissions.manage (PermissionGuard)
 *
 * Base path: /api/v1/admin/permissions
 * Also: /api/v1/rbac/* (public utility endpoints for authenticated users)
 *
 * Clean Architecture: zero Prisma. All delegation to services.
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PermissionsService } from '../services/permissions.service';
import { UserRoleService }    from '../services/user-role.service';
import { RolesGuard }         from '../../auth/guards/roles.guard';
import { PermissionGuard }    from '../guards/permission.guard';
import { Roles }              from '../../auth/decorators/roles.decorator';
import { Permissions }        from '../decorators/permissions.decorator';
import { CurrentUser }        from '../../auth/decorators/current-user.decorator';
import { ZodValidationPipe }  from '../../common/pipes/zod-validation.pipe';
import {
  CreatePermissionDtoClass,
  UpdatePermissionDtoClass,
  CreatePermissionSchema,
  UpdatePermissionSchema,
  ListPermissionsQuerySchema,
  CheckPermissionQuerySchema,
} from '../dto/permission.dto';
import {
  AssignRoleToUserDtoClass,
  AssignRoleToUserSchema,
} from '../dto/role.dto';
import { PERM, ROLE_SLUGS } from '../rbac.constants';
import type { AuthenticatedUser } from '../../auth/auth.types';

// ── Admin Permissions Controller ──────────────────────────────────────────────

@ApiTags('RBAC — Permissions')
@ApiBearerAuth('access-token')
@UseGuards(RolesGuard, PermissionGuard)
@Roles(ROLE_SLUGS.SUPER_ADMIN)
@Permissions(PERM.PERMISSIONS_MANAGE)
@Controller('admin/permissions')
export class PermissionsController {
  private readonly logger = new Logger(PermissionsController.name);

  constructor(
    private readonly permissionsService: PermissionsService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List permissions',
    description: 'Lists all permissions. Optionally filter by module or isActive.',
  })
  @ApiQuery({ name: 'module',   required: false, description: 'Filter by module slug (e.g. questions)' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'limit',    required: false, type: Number, description: 'Max results (default 50, max 200)' })
  @ApiResponse({ status: 200, description: 'Paginated list of permissions.' })
  async findAll(
    @Query(new ZodValidationPipe(ListPermissionsQuerySchema)) query: typeof ListPermissionsQuerySchema._type,
  ) {
    return this.permissionsService.findAll(query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get permission by ID' })
  @ApiParam({ name: 'id', description: 'Permission UUID' })
  @ApiResponse({ status: 200, description: 'Permission detail.' })
  @ApiResponse({ status: 404, description: 'PERMISSION_NOT_FOUND' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.permissionsService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a permission', description: 'Creates a new permission. Slug must follow module.action format.' })
  @ApiBody({ type: CreatePermissionDtoClass })
  @ApiResponse({ status: 201, description: 'Permission created.' })
  @ApiResponse({ status: 409, description: 'DUPLICATE_PERMISSION_SLUG' })
  @ApiResponse({ status: 422, description: 'VALIDATION_ERROR' })
  async create(
    @Body(new ZodValidationPipe(CreatePermissionSchema)) body: typeof CreatePermissionSchema._type,
  ) {
    return this.permissionsService.create(body);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update permission', description: 'Update name, description, or isActive. Deactivating a permission immediately clears all user permission caches.' })
  @ApiParam({ name: 'id', description: 'Permission UUID' })
  @ApiBody({ type: UpdatePermissionDtoClass })
  @ApiResponse({ status: 200, description: 'Permission updated.' })
  @ApiResponse({ status: 404, description: 'PERMISSION_NOT_FOUND' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdatePermissionSchema)) body: typeof UpdatePermissionSchema._type,
  ) {
    return this.permissionsService.update(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate permission', description: 'Deactivates a permission (does not delete — preserves audit trail). Clears all user caches.' })
  @ApiParam({ name: 'id', description: 'Permission UUID' })
  @ApiResponse({ status: 204, description: 'Permission deactivated.' })
  async deactivate(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.permissionsService.update(id, { isActive: false });
  }
}

// ── User Roles Controller (nested under users) ─────────────────────────────

@ApiTags('RBAC — User Roles')
@ApiBearerAuth('access-token')
@UseGuards(RolesGuard, PermissionGuard)
@Roles(ROLE_SLUGS.SUPER_ADMIN, ROLE_SLUGS.ADMIN)
@Permissions(PERM.USERS_MANAGE)
@Controller('admin/users/:userId/roles')
export class UserRolesController {
  private readonly logger = new Logger(UserRolesController.name);

  constructor(private readonly userRoleService: UserRoleService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "List user's roles" })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiResponse({ status: 200, description: "List of user's active roles." })
  async getUserRoles(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.userRoleService.getUserRoles(userId);
  }

  @Get('permissions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Get user's effective permissions", description: 'Returns the union of all permissions granted via all active roles.' })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'Effective permission set.' })
  async getEffectivePermissions(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.userRoleService.getEffectivePermissions(userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Assign role to user' })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiBody({ type: AssignRoleToUserDtoClass })
  @ApiResponse({ status: 201, description: 'Role assigned.' })
  @ApiResponse({ status: 409, description: 'DUPLICATE_ASSIGNMENT' })
  async assignRole(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body(new ZodValidationPipe(AssignRoleToUserSchema)) body: typeof AssignRoleToUserSchema._type,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.userRoleService.assignRole(userId, body, admin.id);
  }

  @Delete(':roleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove role from user', description: 'Deactivates a role assignment. Prevents self-demotion from super_admin.' })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiParam({ name: 'roleId', description: 'Role UUID' })
  @ApiResponse({ status: 204, description: 'Role removed.' })
  @ApiResponse({ status: 403, description: 'SELF_DEMOTION' })
  async removeRole(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @CurrentUser() admin: AuthenticatedUser,
  ): Promise<void> {
    await this.userRoleService.removeRole(userId, roleId, admin);
  }
}

// ── RBAC Utility Controller (for all authenticated users) ──────────────────

@ApiTags('RBAC — Self')
@ApiBearerAuth('access-token')
@Controller('rbac')
export class RbacSelfController {
  constructor(private readonly userRoleService: UserRoleService) {}

  @Get('me/permissions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'My effective permissions', description: "Returns the caller's effective permission set and active roles." })
  @ApiResponse({ status: 200, description: 'Effective permissions and role list.' })
  async myPermissions(@CurrentUser() user: AuthenticatedUser) {
    return this.userRoleService.getEffectivePermissions(user.id);
  }

  @Get('check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check a single permission', description: 'Returns { hasPermission: boolean } for the given permission slug.' })
  @ApiQuery({ name: 'permission', required: true, description: 'Permission slug to check (e.g. questions.create)' })
  @ApiResponse({ status: 200, description: '{ hasPermission: boolean }' })
  async checkPermission(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(CheckPermissionQuerySchema)) query: typeof CheckPermissionQuerySchema._type,
  ) {
    const hasPermission = await this.userRoleService.hasPermission(user.id, query.permission);
    return { hasPermission, permission: query.permission, userId: user.id };
  }
}
