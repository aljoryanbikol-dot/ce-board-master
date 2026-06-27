/**
 * @file payment.dto.ts
 * @module Payments/Dto
 */
import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ── GET /payments query ────────────────────────────────────────────────────────

export const ListPaymentsQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['pending', 'processing', 'succeeded', 'failed', 'refunded', 'canceled']).optional(),
});
export type ListPaymentsQueryDto = z.infer<typeof ListPaymentsQuerySchema>;

// ── POST /payments/:id/verify ──────────────────────────────────────────────────

export const VerifyPaymentSchema = z.object({
  // no body fields — verification re-queries the provider by stored ref
}).optional();

export class PaymentDto {
  @ApiProperty() id!: string;
  @ApiProperty() userId!: string;
  @ApiPropertyOptional() subscriptionId?: string | null;
  @ApiProperty({ example: 49900 }) amountMinor!: number;
  @ApiProperty({ example: 'PHP' }) currency!: string;
  @ApiProperty({ example: 'pending' }) status!: string;
  @ApiProperty({ example: 'paymongo' }) providerType!: string;
  @ApiPropertyOptional({ example: 'gcash' }) methodType?: string | null;
  @ApiPropertyOptional() checkoutUrl?: string | null;
  @ApiPropertyOptional() paidAt?: string | null;
  @ApiProperty() createdAt!: string;
}
