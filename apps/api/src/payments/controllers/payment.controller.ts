/**
 * @file payment.controller.ts
 * @module Payments/Controllers
 *
 * PaymentController — payment queries, manual verification, and the public
 * webhook receivers (one per provider).
 *
 * Webhook endpoints are @Public() (no JWT) but are protected by provider
 * signature verification inside PaymentService. They read the RAW request body
 * (required for HMAC) via the Fastify raw-body accessor.
 *
 * Authenticated endpoints require BOTH role and permission.
 */
import {
  Controller, Get, Headers, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post,
  Query, Req, ServiceUnavailableException, UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags, ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { PaymentProviderType } from '@prisma/client';
import { PaymentService } from '../services/payment.service';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { Public } from '../../auth/decorators/public.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ListPaymentsQuerySchema, PaymentDto } from '../dto/payment.dto';
import { WEBHOOK_SIGNATURE_HEADERS } from '../payments.constants';
import { PERM, ROLE_SLUGS } from '../../rbac/rbac.constants';
import type { AuthenticatedUser } from '../../auth/auth.types';
import type { FastifyRequest } from 'fastify';

const ALL_ROLES = [
  ROLE_SLUGS.SUPER_ADMIN, ROLE_SLUGS.ADMIN, ROLE_SLUGS.CONTENT_ADMIN,
  ROLE_SLUGS.CONTENT_AUTHOR, ROLE_SLUGS.REVIEWER, ROLE_SLUGS.SUBSCRIBER, ROLE_SLUGS.FREE_USER,
] as const;

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  // ── Authenticated payment queries ───────────────────────────────────────────

  @Get('me')
  @UseGuards(RolesGuard, PermissionGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @Roles(...ALL_ROLES)
  @Permissions(PERM.SUBSCRIPTIONS_READ)
  @ApiOperation({ summary: 'List my payments' })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false })
  @ApiResponse({ status: 200, type: [PaymentDto] })
  async listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(ListPaymentsQuerySchema)) query: typeof ListPaymentsQuerySchema._type,
  ) {
    return this.paymentService.listForUser(user, user.id, query);
  }

  @Get(':id')
  @UseGuards(RolesGuard, PermissionGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @Roles(...ALL_ROLES)
  @Permissions(PERM.SUBSCRIPTIONS_READ)
  @ApiOperation({ summary: 'Get payment by ID', description: 'Owner or admin.' })
  @ApiParam({ name: 'id', description: 'Payment UUID' })
  @ApiResponse({ status: 200, type: PaymentDto })
  @ApiResponse({ status: 403, description: 'FORBIDDEN_OWNERSHIP' })
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentService.getById(user, id);
  }

  @Post(':id/verify')
  @UseGuards(RolesGuard, PermissionGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @Roles(...ALL_ROLES)
  @Permissions(PERM.SUBSCRIPTIONS_READ)
  @ApiOperation({ summary: 'Verify a payment with the provider', description: 'Re-queries the provider and reconciles local status.' })
  @ApiParam({ name: 'id', description: 'Payment UUID' })
  @ApiResponse({ status: 200, type: PaymentDto })
  async verify(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentService.verifyPayment(id, user);
  }

  // ── Webhook receivers (public, signature-verified) ──────────────────────────

  @Post('webhooks/paymongo')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async paymongoWebhook(
    @Req() req: FastifyRequest,
    @Headers(WEBHOOK_SIGNATURE_HEADERS.paymongo) signature?: string,
  ) {
    const raw = this.rawBody(req);
    return this.paymentService.handleWebhook(PaymentProviderType.paymongo, raw, signature);
  }

  @Post('webhooks/xendit')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async xenditWebhook(
    @Req() req: FastifyRequest,
    @Headers(WEBHOOK_SIGNATURE_HEADERS.xendit) signature?: string,
  ) {
    const raw = this.rawBody(req);
    return this.paymentService.handleWebhook(PaymentProviderType.xendit, raw, signature);
  }

  @Post('webhooks/mock')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async mockWebhook(
    @Req() req: FastifyRequest,
    @Headers(WEBHOOK_SIGNATURE_HEADERS.mock) signature?: string,
  ) {
    const raw = this.rawBody(req);
    return this.paymentService.handleWebhook(PaymentProviderType.mock, raw, signature);
  }

  /**
   * Obtain the raw request body for signature verification.
   *
   * The raw body is captured by the webhook content-type parser registered at
   * bootstrap (see payments/webhooks/raw-body.plugin.ts). On a correctly
   * configured webhook route it is always present.
   *
   * We deliberately do NOT fall back to JSON.stringify(req.body): re-serialized
   * JSON does not reproduce the provider's exact bytes (key order, whitespace,
   * unicode escaping differ), so any HMAC computed over it would be wrong. A
   * missing raw body means the parser was not registered for this route — a
   * configuration error that must fail verification loudly rather than silently
   * compute a signature over the wrong bytes.
   */
  private rawBody(req: FastifyRequest): string {
    const raw = (req as { rawBody?: string }).rawBody;
    if (typeof raw === 'string') return raw;
    throw new ServiceUnavailableException({
      code: 'WEBHOOK_RAW_BODY_UNAVAILABLE',
      message:
        'Raw request body was not captured for this webhook route. The raw-body ' +
        'parser must be registered at bootstrap for signature verification.',
    });
  }
}
