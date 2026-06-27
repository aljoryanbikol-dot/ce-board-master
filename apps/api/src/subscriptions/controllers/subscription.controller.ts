/**
 * @file subscription.controller.ts
 * @module Subscriptions/Controllers
 *
 * SubscriptionController — self-service subscription HTTP adapter + admin plan
 * management. Base path: /api/v1/subscriptions and /api/v1/plans.
 *
 * Every endpoint requires BOTH role (@Roles) and permission (@Permissions).
 * Clean Architecture: zero Prisma, zero business logic.
 */
import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe,
  Patch, Post, UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags,
} from '@nestjs/swagger';
import { SubscriptionService } from '../services/subscription.service';
import { PlanService } from '../services/plan.service';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  SubscribeSchema, ChangePlanSchema, CancelSubscriptionSchema,
  SubscribeDtoClass, ChangePlanDtoClass, CancelSubscriptionDtoClass, SubscriptionDto,
} from '../dto/subscription.dto';
import {
  CreatePlanSchema, UpdatePlanSchema,
  CreatePlanDtoClass, UpdatePlanDtoClass, PlanDto,
} from '../dto/plan.dto';
import { PERM, ROLE_SLUGS } from '../../rbac/rbac.constants';
import type { AuthenticatedUser } from '../../auth/auth.types';

const ALL_ROLES = [
  ROLE_SLUGS.SUPER_ADMIN, ROLE_SLUGS.ADMIN, ROLE_SLUGS.CONTENT_ADMIN,
  ROLE_SLUGS.CONTENT_AUTHOR, ROLE_SLUGS.REVIEWER, ROLE_SLUGS.SUBSCRIBER, ROLE_SLUGS.FREE_USER,
] as const;

@ApiTags('Subscriptions')
@ApiBearerAuth('access-token')
@UseGuards(RolesGuard, PermissionGuard)
@Controller('subscriptions')
export class SubscriptionController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
  ) {}

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @Roles(...ALL_ROLES)
  @Permissions(PERM.SUBSCRIPTIONS_READ)
  @ApiOperation({ summary: 'Get my active subscription' })
  @ApiResponse({ status: 200, type: SubscriptionDto })
  async getMine(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptionService.getMySubscription(user);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(...ALL_ROLES)
  @Permissions(PERM.SUBSCRIPTIONS_READ)
  @ApiOperation({ summary: 'Subscribe to a plan', description: 'Creates a subscription. Free/trial plans activate immediately; paid plans return a checkout URL.' })
  @ApiBody({ type: SubscribeDtoClass })
  @ApiResponse({ status: 201, description: 'Subscription created (+ payment checkout if paid).' })
  @ApiResponse({ status: 409, description: 'ALREADY_SUBSCRIBED' })
  async subscribe(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(SubscribeSchema)) body: typeof SubscribeSchema._type,
  ) {
    return this.subscriptionService.subscribe(user, body);
  }

  @Post('change')
  @HttpCode(HttpStatus.OK)
  @Roles(...ALL_ROLES)
  @Permissions(PERM.SUBSCRIPTIONS_READ)
  @ApiOperation({ summary: 'Upgrade or downgrade plan', description: 'Upgrade charges immediately; downgrade switches at period end.' })
  @ApiBody({ type: ChangePlanDtoClass })
  @ApiResponse({ status: 200, description: 'Plan change initiated.' })
  @ApiResponse({ status: 400, description: 'NO_ACTIVE_SUBSCRIPTION | SAME_PLAN' })
  async changePlan(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(ChangePlanSchema)) body: typeof ChangePlanSchema._type,
  ) {
    return this.subscriptionService.changePlan(user, body);
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(...ALL_ROLES)
  @Permissions(PERM.SUBSCRIPTIONS_READ)
  @ApiOperation({ summary: 'Cancel subscription', description: 'Cancel at period end (default) or immediately.' })
  @ApiBody({ type: CancelSubscriptionDtoClass })
  @ApiResponse({ status: 200, type: SubscriptionDto })
  @ApiResponse({ status: 400, description: 'NO_ACTIVE_SUBSCRIPTION' })
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(CancelSubscriptionSchema)) body: typeof CancelSubscriptionSchema._type,
  ) {
    return this.subscriptionService.cancel(user, body);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(...ALL_ROLES)
  @Permissions(PERM.SUBSCRIPTIONS_READ)
  @ApiOperation({ summary: 'Get subscription by ID', description: 'Owner or admin (subscriptions.manage).' })
  @ApiParam({ name: 'id', description: 'Subscription UUID' })
  @ApiResponse({ status: 200, type: SubscriptionDto })
  @ApiResponse({ status: 403, description: 'FORBIDDEN_OWNERSHIP' })
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.subscriptionService.getById(user, id);
  }
}

@ApiTags('Subscription Plans')
@ApiBearerAuth('access-token')
@UseGuards(RolesGuard, PermissionGuard)
@Controller('plans')
export class PlanController {
  constructor(private readonly planService: PlanService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(...ALL_ROLES)
  @Permissions(PERM.SUBSCRIPTIONS_READ)
  @ApiOperation({ summary: 'List active plans' })
  @ApiResponse({ status: 200, type: [PlanDto] })
  async list() {
    return this.planService.listActive();
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(...ALL_ROLES)
  @Permissions(PERM.SUBSCRIPTIONS_READ)
  @ApiOperation({ summary: 'Get plan by ID' })
  @ApiParam({ name: 'id', description: 'Plan UUID' })
  @ApiResponse({ status: 200, type: PlanDto })
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return this.planService.getById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(ROLE_SLUGS.SUPER_ADMIN, ROLE_SLUGS.ADMIN)
  @Permissions(PERM.SUBSCRIPTIONS_MANAGE)
  @ApiOperation({ summary: 'Create plan (admin)' })
  @ApiBody({ type: CreatePlanDtoClass })
  @ApiResponse({ status: 201, type: PlanDto })
  @ApiResponse({ status: 409, description: 'DUPLICATE_PLAN_SLUG' })
  async create(@Body(new ZodValidationPipe(CreatePlanSchema)) body: typeof CreatePlanSchema._type) {
    return this.planService.create(body);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(ROLE_SLUGS.SUPER_ADMIN, ROLE_SLUGS.ADMIN)
  @Permissions(PERM.SUBSCRIPTIONS_MANAGE)
  @ApiOperation({ summary: 'Update plan (admin)' })
  @ApiParam({ name: 'id', description: 'Plan UUID' })
  @ApiBody({ type: UpdatePlanDtoClass })
  @ApiResponse({ status: 200, type: PlanDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdatePlanSchema)) body: typeof UpdatePlanSchema._type,
  ) {
    return this.planService.update(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(ROLE_SLUGS.SUPER_ADMIN, ROLE_SLUGS.ADMIN)
  @Permissions(PERM.SUBSCRIPTIONS_MANAGE)
  @ApiOperation({ summary: 'Soft-delete plan (admin)' })
  @ApiParam({ name: 'id', description: 'Plan UUID' })
  @ApiResponse({ status: 204 })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.planService.softDelete(id);
  }
}
