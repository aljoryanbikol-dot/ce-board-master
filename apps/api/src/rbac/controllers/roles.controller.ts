/**
 * @file roles.controller.ts
 * @module Rbac/Controllers
 *
 * RolesController — Admin CRUD for roles and role assignments.
 *
 * All endpoints require:
 * - JWT authentication (JwtAuthGuard, global APP_GUARD)
 * - Role: super_admin (RolesGuard)
 * - Permission: roles.manage (PermissionGuard)
 *
 * Base path: /api/v1/admin/roles
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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RolesService }    from '../services/roles.service';
import { UserRoleService } from '../services/user-role.service';
import { RolesGuard }      from '../../auth/guards/roles.guard';
import { PermissionGuard } from '../guards/permission.guard';
import { Roles }           from '../../auth/decorators/roles.decorator';
import { Permissions }     from '../decorators/permissions.decorator';
import { CurrentUser }     from '../../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  CreateRoleDtoClass,
  UpdateRoleDtoClass,
  AssignPermissionToRoleDtoClass,
  AssignRoleToUserDtoClass,
  CreateRoleSchema,
  UpdateRoleSchema,
  AssignPermissionToRoleSchema,
  AssignRoleToUserSchema,
} from '../dto/role.dto';
import { PERM, ROLE_SLUGS } from '../rbac.constants';
import type { AuthenticatedUser } from '../../auth/auth.types';

@ApiTags('RBAC — Roles')
@ApiBearerAuth('access-token')
@UseGuards(RolesGuard, PermissionGuard)
@Roles(ROLE_SLUGS.SUPER_ADMIN, ROLE_SLUGS.ADMIN)
@Permissions(PERM.ROLES_MANAGE)
@Controller('admin/roles')
export class RolesController {
  private readonly logger = new Logger(RolesController.name);

  constructor(
    private readonly rolesService:    RolesService,
    private readonly userRoleService: UserRoleService,
  ) {}

  // ── GET /admin/roles ───────────────────────────────────────────────────────

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all roles', description: 'Returns all roles with permission counts.' })
  @ApiResponse({ status: 200, description: 'List of roles with permission counts.' })
  @ApiResponse({ status: 401, description: 'UNAUTHORIZED' })
  @ApiResponse({ status: 403, description: 'INSUFFICIENT_PERMISSIONS' })
  async findAll() {
    return this.rolesService.findAll();
  }

  // ── GET /admin/roles/:id ───────────────────────────────────────────────────

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get role by ID', description: 'Returns a single role with its full permission list.' })
  @ApiParam({ name: 'id', description: 'Role UUID' })
  @ApiResponse({ status: 200, description: 'Role detail with permissions.' })
  @ApiResponse({ status: 404, description: 'ROLE_NOT_FOUND' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.findById(id);
  }

  // ── POST /admin/roles ──────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions(PERM.ROLES_MANAGE)
  @ApiOperation({ summary: 'Create a new role', description: 'Creates a custom (non-system) role.' })
  @ApiBody({ type: CreateRoleDtoClass })
  @ApiResponse({ status: 201, description: 'Role created.' })
  @ApiResponse({ status: 409, description: 'DUPLICATE_ROLE_SLUG' })
  @ApiResponse({ status: 422, description: 'VALIDATION_ERROR' })
  async create(
    @Body(new ZodValidationPipe(CreateRoleSchema)) body: typeof CreateRoleSchema._type,
  ) {
    return this.rolesService.create(body);
  }

  // ── PATCH /admin/roles/:id ─────────────────────────────────────────────────

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update role metadata', description: 'Updates name, description, sortOrder, or isActive. System roles cannot be renamed.' })
  @ApiParam({ name: 'id', description: 'Role UUID' })
  @ApiBody({ type: UpdateRoleDtoClass })
  @ApiResponse({ status: 200, description: 'Role updated.' })
  @ApiResponse({ status: 403, description: 'ROLE_IS_SYSTEM — system roles cannot be renamed.' })
  @ApiResponse({ status: 404, description: 'ROLE_NOT_FOUND' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateRoleSchema)) body: typeof UpdateRoleSchema._type,
  ) {
    return this.rolesService.update(id, body);
  }

  // ── DELETE /admin/roles/:id ────────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a role', description: 'Soft-deletes a custom role. System roles and super_admin cannot be deleted.' })
  @ApiParam({ name: 'id', description: 'Role UUID' })
  @ApiResponse({ status: 204, description: 'Role deleted.' })
  @ApiResponse({ status: 403, description: 'ROLE_IS_SYSTEM' })
  @ApiResponse({ status: 404, description: 'ROLE_NOT_FOUND' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.rolesService.delete(id);
  }

  // ── GET /admin/roles/:id/permissions ──────────────────────────────────────

  @Get(':id/permissions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "List role's permissions", description: 'Returns all permissions assigned to this role.' })
  @ApiParam({ name: 'id', description: 'Role UUID' })
  @ApiResponse({ status: 200, description: 'List of permissions.' })
  async getRolePermissions(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.getRolePermissions(id);
  }

  // ── POST /admin/roles/:id/permissions ─────────────────────────────────────

  @Post(':id/permissions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Assign permission to role', description: 'Grants a permission to a role. Cache invalidated immediately.' })
  @ApiParam({ name: 'id', description: 'Role UUID' })
  @ApiBody({ type: AssignPermissionToRoleDtoClass })
  @ApiResponse({ status: 201, description: 'Permission assigned.' })
  @ApiResponse({ status: 409, description: 'DUPLICATE_ASSIGNMENT — permission already assigned.' })
  async assignPermission(
    @Param('id', ParseUUIDPipe) roleId: string,
    @Body(new ZodValidationPipe(AssignPermissionToRoleSchema)) body: typeof AssignPermissionToRoleSchema._type,
  ): Promise<{ message: string }> {
    await this.rolesService.assignPermission(roleId, body.permissionId);
    return { message: 'Permission assigned to role.' };
  }

  // ── DELETE /admin/roles/:id/permissions/:permissionId ─────────────────────

  @Delete(':id/permissions/:permissionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove permission from role', description: 'Revokes a permission from a role. Cache invalidated immediately.' })
  @ApiParam({ name: 'id',           description: 'Role UUID' })
  @ApiParam({ name: 'permissionId', description: 'Permission UUID' })
  @ApiResponse({ status: 204, description: 'Permission removed.' })
  @ApiResponse({ status: 404, description: 'PERMISSION_NOT_FOUND — not assigned to this role.' })
  async removePermission(
    @Param('id',           ParseUUIDPipe) roleId:       string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
  ): Promise<void> {
    await this.rolesService.removePermission(roleId, permissionId);
  }

  // ── POST /admin/users/:userId/roles ───────────────────────────────────────

  @Post('../users/:userId/roles')
  @HttpCode(HttpStatus.CREATED)
  @Roles(ROLE_SLUGS.SUPER_ADMIN, ROLE_SLUGS.ADMIN)
  @Permissions(PERM.USERS_MANAGE)
  @ApiOperation({ summary: 'Assign role to user', description: 'Grants a role to a user. Optionally expires.' })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiBody({ type: AssignRoleToUserDtoClass })
  @ApiResponse({ status: 201, description: 'Role assigned.' })
  @ApiResponse({ status: 404, description: 'USER_NOT_FOUND | ROLE_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'DUPLICATE_ASSIGNMENT' })
  async assignRoleToUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body(new ZodValidationPipe(AssignRoleToUserSchema)) body: typeof AssignRoleToUserSchema._type,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.userRoleService.assignRole(userId, body, admin.id);
  }
}
