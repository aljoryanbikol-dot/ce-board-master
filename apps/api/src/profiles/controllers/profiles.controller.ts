/**
 * @file profiles.controller.ts
 * @module Profiles/Controllers
 *
 * ProfileController — self-service profile HTTP adapter.
 *
 * Base path: /api/v1/profile
 *
 * All endpoints operate on the authenticated caller's own profile.
 * Authentication is enforced by the global JwtAuthGuard. Because these are
 * self-service routes, any authenticated user may access them — but only
 * for their OWN data (req.user.id). Both role and permission decorators are
 * applied for defence-in-depth and consistency with the platform contract.
 *
 * Clean Architecture: zero Prisma, zero business logic. All delegation to
 * ProfileService.
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ProfileService }  from '../services/profiles.service';
import { RolesGuard }      from '../../auth/guards/roles.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Roles }           from '../../auth/decorators/roles.decorator';
import { Permissions }     from '../../rbac/decorators/permissions.decorator';
import { CurrentUser }     from '../../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  UpdateProfileSchema,
  UpdateAvatarSchema,
  UpdatePreferencesSchema,
  UpdateProfileDtoClass,
  UpdateAvatarDtoClass,
  UpdatePreferencesDtoClass,
  ProfileDetailDto,
} from '../dto/profile.dto';
import { PERM, ROLE_SLUGS } from '../../rbac/rbac.constants';
import type { AuthenticatedUser } from '../../auth/auth.types';

// All authenticated roles may manage their own profile.
const ALL_ROLES = [
  ROLE_SLUGS.SUPER_ADMIN, ROLE_SLUGS.ADMIN, ROLE_SLUGS.CONTENT_ADMIN,
  ROLE_SLUGS.CONTENT_AUTHOR, ROLE_SLUGS.REVIEWER,
  ROLE_SLUGS.SUBSCRIBER, ROLE_SLUGS.FREE_USER,
] as const;

@ApiTags('Profile')
@ApiBearerAuth('access-token')
@UseGuards(RolesGuard, PermissionGuard)
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  // ── GET /profile ──────────────────────────────────────────────────────────

  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(...ALL_ROLES)
  @Permissions(PERM.USERS_READ)
  @ApiOperation({ summary: 'Get own profile', description: 'Returns the authenticated user\'s full profile.' })
  @ApiResponse({ status: 200, type: ProfileDetailDto, description: 'Profile detail.' })
  @ApiResponse({ status: 401, description: 'UNAUTHORIZED' })
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.profileService.getOwnProfile(user.id);
  }

  // ── PATCH /profile ────────────────────────────────────────────────────────

  @Patch()
  @HttpCode(HttpStatus.OK)
  @Roles(...ALL_ROLES)
  @Permissions(PERM.USERS_WRITE)
  @ApiOperation({ summary: 'Update own profile', description: 'Updates profile fields with optimistic locking.' })
  @ApiBody({ type: UpdateProfileDtoClass })
  @ApiResponse({ status: 200, type: ProfileDetailDto, description: 'Updated profile.' })
  @ApiResponse({ status: 409, description: 'VERSION_CONFLICT' })
  @ApiResponse({ status: 422, description: 'VALIDATION_ERROR' })
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(UpdateProfileSchema)) body: typeof UpdateProfileSchema._type,
  ) {
    return this.profileService.updateProfile(user.id, body);
  }

  // ── PATCH /profile/avatar ─────────────────────────────────────────────────

  @Patch('avatar')
  @HttpCode(HttpStatus.OK)
  @Roles(...ALL_ROLES)
  @Permissions(PERM.USERS_WRITE)
  @ApiOperation({ summary: 'Update avatar', description: 'Sets the avatar URL (must be HTTPS).' })
  @ApiBody({ type: UpdateAvatarDtoClass })
  @ApiResponse({ status: 200, type: ProfileDetailDto, description: 'Updated profile with new avatar.' })
  @ApiResponse({ status: 422, description: 'VALIDATION_ERROR — avatarUrl must be a valid HTTPS URL.' })
  async updateAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(UpdateAvatarSchema)) body: typeof UpdateAvatarSchema._type,
  ) {
    return this.profileService.updateAvatar(user.id, body);
  }

  // ── PATCH /profile/preferences ────────────────────────────────────────────

  @Patch('preferences')
  @HttpCode(HttpStatus.OK)
  @Roles(...ALL_ROLES)
  @Permissions(PERM.USERS_WRITE)
  @ApiOperation({ summary: 'Update preferences', description: 'Updates language, timezone, theme, and notification settings.' })
  @ApiBody({ type: UpdatePreferencesDtoClass })
  @ApiResponse({ status: 200, type: ProfileDetailDto, description: 'Updated profile with new preferences.' })
  @ApiResponse({ status: 422, description: 'VALIDATION_ERROR' })
  async updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(UpdatePreferencesSchema)) body: typeof UpdatePreferencesSchema._type,
  ) {
    return this.profileService.updatePreferences(user.id, body);
  }
}
