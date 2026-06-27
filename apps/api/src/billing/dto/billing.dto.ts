/**
 * @file billing.dto.ts
 * @module Billing/Dto
 */
import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const ListInvoicesQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['draft', 'issued', 'paid', 'void']).optional(),
});
export type ListInvoicesQueryDto = z.infer<typeof ListInvoicesQuerySchema>;

export class InvoiceDto {
  @ApiProperty() id!: string;
  @ApiProperty() number!: string;
  @ApiProperty() userId!: string;
  @ApiPropertyOptional() subscriptionId?: string | null;
  @ApiProperty({ example: 'paid' }) status!: string;
  @ApiProperty({ example: 49900 }) subtotalMinor!: number;
  @ApiProperty({ example: 0 }) taxMinor!: number;
  @ApiProperty({ example: 49900 }) totalMinor!: number;
  @ApiProperty({ example: 'PHP' }) currency!: string;
  @ApiProperty({ type: 'array', items: { type: 'object' } }) lineItems!: unknown[];
  @ApiPropertyOptional() receiptUrl?: string | null;
  @ApiPropertyOptional() issuedAt?: string | null;
  @ApiPropertyOptional() paidAt?: string | null;
  @ApiProperty() createdAt!: string;
}
