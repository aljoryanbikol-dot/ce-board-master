/**
 * @file users.controller.ts
 * @module Users/Controllers
 *
 * UsersController — admin user management HTTP adapter.
 *
 * Base path: /api/v1/users
 *
 * Every endpoint requires BOTH:
 * - Role validation (RolesGuard + @Roles)
 * - Permission validation (PermissionGuard + @Permissions)
 *
 * Clean Architecture: zero Prisma, zero business logic. All delegation to
 * UsersService. Ownership/admin override is resolved in the service layer.
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { UsersService }   from '../services/users.service';
import { RolesGuard }     from '../../auth/guards/roles.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Roles }          from '../../auth/decorators/roles.decorator';
import { Permissions }    from '../../rbac/decorators/permissions.decorator';
import { CurrentUser }    from '../../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  ListUsersQuerySchema,
  UpdateUserSchema,
  UpdateUserDtoClass,
  UserDetailDto,
  UserSummaryDto,
} from '../dto/user.dto';
import { PERM, ROLE_SLUGS } from '../../rbac/rbac.constants';
import type { AuthenticatedUser } from '../../auth/auth.types';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@UseGuards(RolesGuard, PermissionGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ── GET /users ────────────────────────────────────────────────────────────

  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(ROLE_SLUGS.SUPER_ADMIN, ROLE_SLUGS.ADMIN)
  @Permissions(PERM.USERS_READ)
  @ApiOperation({ summary: 'List users', description: 'Cursor-paginated list of users with filtering and search. Admin only.' })
  @ApiQuery({ name: 'cursor',   required: false, description: 'UUID cursor for pagination' })
  @ApiQuery({ name: 'limit',    required: false, type: Number, description: 'Page size (1–200, default 20)' })
  @ApiQuery({ name: 'status',   required: false, enum: ['pending', 'active', 'suspended'] })
  @ApiQuery({ name: 'role',     required: false, description: 'Filter by role slug' })
  @ApiQuery({ name: 'search',   required: false, description: 'Search email, username, display name' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiResponse({ status: 200, type: [UserSummaryDto], description: 'Paginated user list.' })
  @ApiResponse({ status: 401, description: 'UNAUTHORIZED' })
  @ApiResponse({ status: 403, description: 'FORBIDDEN_PERMISSION' })
  async findAll(
    @Query(new ZodValidationPipe(ListUsersQuerySchema)) query: typeof ListUsersQuerySchema._type,
  ) {
    // Service returns { data, pagination } — TransformInterceptor lifts pagination into meta
    return this.usersService.findAll(query);
  }

  // ── GET /users/:id ────────────────────────────────────────────────────────

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(ROLE_SLUGS.SUPER_ADMIN, ROLE_SLUGS.ADMIN, ROLE_SLUGS.SUBSCRIBER, ROLE_SLUGS.FREE_USER)
  @Permissions(PERM.USERS_READ)
  @ApiOperation({ summary: 'Get user by ID', description: 'Returns a single user. Owner can read self; admins can read any (users.manage).' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, type: UserDetailDto, description: 'User detail.' })
  @ApiResponse({ status: 403, description: 'FORBIDDEN_OWNERSHIP' })
  @ApiResponse({ status: 404, description: 'USER_NOT_FOUND' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.findById(id, user);
  }

  // ── PATCH /users/:id ──────────────────────────────────────────────────────

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(ROLE_SLUGS.SUPER_ADMIN, ROLE_SLUGS.ADMIN)
  @Permissions(PERM.USERS_WRITE)
  @ApiOperation({ summary: 'Update user', description: 'Admin update of username/status/flags with optimistic locking.' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiBody({ type: UpdateUserDtoClass })
  @ApiResponse({ status: 200, type: UserDetailDto, description: 'Updated user.' })
  @ApiResponse({ status: 403, description: 'FORBIDDEN_OWNERSHIP | CANNOT_MODIFY_SUPERADMIN' })
  @ApiResponse({ status: 404, description: 'USER_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'VERSION_CONFLICT | USERNAME_TAKEN' })
  @ApiResponse({ status: 422, description: 'VALIDATION_ERROR' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateUserSchema)) body: typeof UpdateUserSchema._type,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.update(id, body, user);
  }

  // ── DELETE /users/:id ─────────────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(ROLE_SLUGS.SUPER_ADMIN, ROLE_SLUGS.ADMIN)
  @Permissions(PERM.USERS_DELETE)
  @ApiOperation({ summary: 'Soft-delete user', description: 'Soft-deletes a user and revokes all sessions. Cannot delete self or super_admin.' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 204, description: 'User soft-deleted.' })
  @ApiResponse({ status: 403, description: 'CANNOT_DELETE_SELF | CANNOT_MODIFY_SUPERADMIN | FORBIDDEN_OWNERSHIP' })
  @ApiResponse({ status: 404, description: 'USER_NOT_FOUND' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.usersService.softDelete(id, user);
  }
}
