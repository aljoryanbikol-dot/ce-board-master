/**
 * @file subscription.dto.ts
 * @module Subscriptions/Dto
 */
import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const PROVIDERS = ['paymongo', 'xendit', 'mock'] as const;
const METHODS = ['gcash', 'maya', 'online_banking', 'qrph', 'credit_card', 'debit_card'] as const;

// ── POST /subscriptions (subscribe) ────────────────────────────────────────────

export const SubscribeSchema = z.object({
  planId:   z.string().uuid({ message: 'planId must be a valid UUID.' }),
  provider: z.enum(PROVIDERS).optional(),
  method:   z.enum(METHODS).optional(),
  /** Idempotency key — guarantees at-most-once checkout creation. */
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});
export type SubscribeDto = z.infer<typeof SubscribeSchema>;

// ── POST /subscriptions/change (upgrade/downgrade) ─────────────────────────────

export const ChangePlanSchema = z.object({
  planId:   z.string().uuid({ message: 'planId must be a valid UUID.' }),
  provider: z.enum(PROVIDERS).optional(),
  method:   z.enum(METHODS).optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});
export type ChangePlanDto = z.infer<typeof ChangePlanSchema>;

// ── POST /subscriptions/cancel ─────────────────────────────────────────────────

export const CancelSubscriptionSchema = z.object({
  /** If true, keep access until period end; else cancel immediately. */
  atPeriodEnd: z.boolean().default(true),
  reason:      z.string().trim().max(500).optional(),
});
export type CancelSubscriptionDto = z.infer<typeof CancelSubscriptionSchema>;

// ── Swagger classes ────────────────────────────────────────────────────────────

export class SubscribeDtoClass {
  @ApiProperty({ description: 'Plan UUID to subscribe to.' })
  planId!: string;

  @ApiPropertyOptional({ enum: PROVIDERS, description: 'Payment provider. Defaults to configured provider.' })
  provider?: string;

  @ApiPropertyOptional({ enum: METHODS, description: 'Payment method.' })
  method?: string;

  @ApiPropertyOptional({ description: 'Idempotency key for at-most-once checkout.' })
  idempotencyKey?: string;
}

export class ChangePlanDtoClass {
  @ApiProperty({ description: 'Target plan UUID (upgrade or downgrade).' })
  planId!: string;

  @ApiPropertyOptional({ enum: PROVIDERS })
  provider?: string;

  @ApiPropertyOptional({ enum: METHODS })
  method?: string;

  @ApiPropertyOptional()
  idempotencyKey?: string;
}

export class CancelSubscriptionDtoClass {
  @ApiPropertyOptional({ default: true, description: 'Cancel at period end (true) or immediately (false).' })
  atPeriodEnd?: boolean;

  @ApiPropertyOptional({ description: 'Optional cancellation reason.' })
  reason?: string;
}

export class SubscriptionDto {
  @ApiProperty() id!: string;
  @ApiProperty() userId!: string;
  @ApiProperty() planId!: string;
  @ApiProperty({ example: 'active' }) status!: string;
  @ApiPropertyOptional() currentPeriodStart?: string | null;
  @ApiPropertyOptional() currentPeriodEnd?: string | null;
  @ApiPropertyOptional() trialEndsAt?: string | null;
  @ApiProperty() cancelAtPeriodEnd!: boolean;
  @ApiProperty() autoRenew!: boolean;
  @ApiProperty() version!: number;
}
