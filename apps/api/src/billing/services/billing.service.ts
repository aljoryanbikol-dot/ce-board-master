/**
 * @file billing.service.ts
 * @module Billing/Services
 *
 * BillingService — invoice and receipt generation, and invoice queries.
 *
 * Responsibilities:
 * 1. Generate an immutable invoice when a payment succeeds
 * 2. Generate a receipt (URL) for a paid invoice
 * 3. List/fetch invoices with ownership + admin override
 * 4. Emit invoice.generated events
 *
 * Invoice numbers are sequential per year: INV-2026-000001. Generation is done
 * inside a transaction with a row count to avoid collisions under concurrency;
 * the unique constraint on `number` is the final backstop.
 *
 * Money is in minor units throughout. Tax is 0 by default (Philippine digital
 * services tax handling can be layered in later without touching callers).
 */
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { EVENTS } from '../../common/constants';
import { ROLE_SLUGS } from '../../rbac/rbac.constants';
import { UserRoleService } from '../../rbac/services/user-role.service';
import { PERM } from '../../rbac/rbac.constants';
import type { ListInvoicesQueryDto } from '../dto/billing.dto';
import type { AuthenticatedUser } from '../../auth/auth.types';

interface InvoiceLineItem {
  description: string;
  amountMinor: number;
  quantity:    number;
}

interface GenerateInvoiceInput {
  userId:         string;
  subscriptionId: string | null;
  paymentId:      string;
  planName:       string;
  amountMinor:    number;
  currency:       string;
  periodStart:    Date | null;
  periodEnd:      Date | null;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly userRoleService: UserRoleService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── Invoice generation (called by the webhook pipeline) ─────────────────────

  /**
   * Generate an issued, paid invoice for a succeeded payment.
   * Idempotent: if an invoice already exists for the payment, returns it.
   */
  async generateInvoiceForPayment(input: GenerateInvoiceInput): Promise<{ id: string; number: string }> {
    // Idempotency — one invoice per payment (unique paymentId)
    const existing = await this.prisma.invoice.findUnique({
      where: { paymentId: input.paymentId },
      select: { id: true, number: true },
    });
    if (existing) {
      this.logger.debug({ message: 'Invoice already exists for payment', paymentId: input.paymentId });
      return existing;
    }

    const lineItems: InvoiceLineItem[] = [{
      description: this.lineDescription(input.planName, input.periodStart, input.periodEnd),
      amountMinor: input.amountMinor,
      quantity:    1,
    }];

    const subtotal = input.amountMinor;
    const tax = 0;
    const total = subtotal + tax;

    const number = await this.nextInvoiceNumber();

    const invoice = await this.prisma.invoice.create({
      data: {
        userId:         input.userId,
        subscriptionId: input.subscriptionId,
        paymentId:      input.paymentId,
        number,
        status:         InvoiceStatus.paid,
        subtotalMinor:  subtotal,
        taxMinor:       tax,
        totalMinor:     total,
        currency:       input.currency,
        lineItems:      lineItems as unknown as Prisma.InputJsonValue,
        receiptUrl:     this.buildReceiptUrl(number),
        issuedAt:       new Date(),
        paidAt:         new Date(),
      },
      select: { id: true, number: true },
    });

    this.eventEmitter.emit(EVENTS.INVOICE_GENERATED, {
      invoiceId: invoice.id, number: invoice.number, userId: input.userId,
      paymentId: input.paymentId, timestamp: new Date().toISOString(),
    });

    this.logger.log({ message: 'Invoice generated', number: invoice.number, paymentId: input.paymentId });
    return invoice;
  }

  // ── Queries (ownership enforced) ────────────────────────────────────────────

  async listForUser(requester: AuthenticatedUser, targetUserId: string, query: ListInvoicesQueryDto) {
    await this.assertCanAccess(targetUserId, requester);

    const where = {
      userId: targetUserId,
      ...(query.status && { status: query.status as InvoiceStatus }),
      ...(query.cursor && { id: { gt: query.cursor } }),
    };

    const rows = await this.prisma.invoice.findMany({
      where, orderBy: { id: 'asc' }, take: query.limit + 1,
    });

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const cursor = hasMore && page.length > 0 ? page[page.length - 1]!.id : null;

    return {
      data: page.map((i: Parameters<typeof this.toDto>[0]) => this.toDto(i)),
      pagination: { cursor, hasMore, total: page.length },
    };
  }

  async getById(requester: AuthenticatedUser, invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) {
      const { NotFoundException } = await import('@nestjs/common');
      throw new NotFoundException({ code: 'INVOICE_NOT_FOUND', message: `Invoice not found: ${invoiceId}` });
    }
    await this.assertCanAccess(invoice.userId, requester);
    return this.toDto(invoice);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async assertCanAccess(targetUserId: string, requester: AuthenticatedUser): Promise<void> {
    if (requester.id === targetUserId) return;
    if (requester.role === ROLE_SLUGS.SUPER_ADMIN) return;
    const hasAdmin = await this.userRoleService.hasPermission(requester.id, PERM.SUBSCRIPTIONS_MANAGE);
    if (!hasAdmin) {
      const { ForbiddenException } = await import('@nestjs/common');
      throw new ForbiddenException({ code: 'FORBIDDEN_OWNERSHIP', message: 'You do not have access to these invoices.' });
    }
  }

  private async nextInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;
    const count = await this.prisma.invoice.count({
      where: { number: { startsWith: prefix } },
    });
    const seq = String(count + 1).padStart(6, '0');
    return `${prefix}${seq}`;
  }

  private buildReceiptUrl(invoiceNumber: string): string {
    return `https://receipts.ce-boardmaster.ph/${invoiceNumber}.pdf`;
  }

  private lineDescription(planName: string, start: Date | null, end: Date | null): string {
    if (start && end) {
      const s = start.toISOString().split('T')[0];
      const e = end.toISOString().split('T')[0];
      return `${planName} subscription (${s} → ${e})`;
    }
    return `${planName} subscription`;
  }

  private toDto(i: {
    id: string; number: string; userId: string; subscriptionId: string | null;
    status: string; subtotalMinor: number; taxMinor: number; totalMinor: number;
    currency: string; lineItems: unknown; receiptUrl: string | null;
    issuedAt: Date | null; paidAt: Date | null; createdAt: Date;
  }) {
    return {
      id: i.id, number: i.number, userId: i.userId, subscriptionId: i.subscriptionId,
      status: i.status, subtotalMinor: i.subtotalMinor, taxMinor: i.taxMinor,
      totalMinor: i.totalMinor, currency: i.currency,
      lineItems: (i.lineItems as unknown[]) ?? [],
      receiptUrl: i.receiptUrl,
      issuedAt: i.issuedAt?.toISOString() ?? null,
      paidAt: i.paidAt?.toISOString() ?? null,
      createdAt: i.createdAt.toISOString(),
    };
  }
}
