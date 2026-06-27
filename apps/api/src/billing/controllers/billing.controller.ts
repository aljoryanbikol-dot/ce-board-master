/**
 * @file billing.controller.ts
 * @module Billing/Controllers
 *
 * BillingController — invoice queries for the authenticated user.
 * Base path: /api/v1/billing.
 *
 * Every endpoint requires BOTH role (@Roles) and permission (@Permissions).
 * Ownership + admin override is resolved in BillingService.
 * Clean Architecture: zero Prisma, zero business logic.
 */
import {
  Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Query, UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags,
} from '@nestjs/swagger';
import { BillingService } from '../services/billing.service';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ListInvoicesQuerySchema, InvoiceDto } from '../dto/billing.dto';
import { PERM, ROLE_SLUGS } from '../../rbac/rbac.constants';
import type { AuthenticatedUser } from '../../auth/auth.types';

const ALL_ROLES = [
  ROLE_SLUGS.SUPER_ADMIN, ROLE_SLUGS.ADMIN, ROLE_SLUGS.CONTENT_ADMIN,
  ROLE_SLUGS.CONTENT_AUTHOR, ROLE_SLUGS.REVIEWER, ROLE_SLUGS.SUBSCRIBER, ROLE_SLUGS.FREE_USER,
] as const;

@ApiTags('Billing')
@ApiBearerAuth('access-token')
@UseGuards(RolesGuard, PermissionGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('invoices')
  @HttpCode(HttpStatus.OK)
  @Roles(...ALL_ROLES)
  @Permissions(PERM.SUBSCRIPTIONS_READ)
  @ApiOperation({ summary: 'List my invoices' })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ['draft', 'issued', 'paid', 'void'] })
  @ApiResponse({ status: 200, type: [InvoiceDto] })
  async listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(ListInvoicesQuerySchema)) query: typeof ListInvoicesQuerySchema._type,
  ) {
    return this.billingService.listForUser(user, user.id, query);
  }

  @Get('invoices/:id')
  @HttpCode(HttpStatus.OK)
  @Roles(...ALL_ROLES)
  @Permissions(PERM.SUBSCRIPTIONS_READ)
  @ApiOperation({ summary: 'Get invoice by ID', description: 'Owner or admin (subscriptions.manage).' })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiResponse({ status: 200, type: InvoiceDto })
  @ApiResponse({ status: 403, description: 'FORBIDDEN_OWNERSHIP' })
  @ApiResponse({ status: 404, description: 'INVOICE_NOT_FOUND' })
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.billingService.getById(user, id);
  }
}
