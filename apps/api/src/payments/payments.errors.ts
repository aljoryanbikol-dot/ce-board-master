/**
 * @file payments.errors.ts
 * @module Payments
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { PAYMENT_ERROR_CODES } from './payments.constants';

export const PaymentErrors = {
  notFound: (id: string) =>
    new NotFoundException({ code: PAYMENT_ERROR_CODES.PAYMENT_NOT_FOUND, message: `Payment not found: ${id}` }),

  providerNotFound: (type: string) =>
    new BadRequestException({ code: PAYMENT_ERROR_CODES.PROVIDER_NOT_FOUND, message: `No payment provider registered for '${type}'.` }),

  providerError: (detail: string) =>
    new ServiceUnavailableException({ code: PAYMENT_ERROR_CODES.PROVIDER_ERROR, message: `Payment provider error: ${detail}` }),

  invalidSignature: () =>
    new UnauthorizedException({ code: PAYMENT_ERROR_CODES.INVALID_WEBHOOK_SIGNATURE, message: 'Webhook signature verification failed.' }),

  duplicateWebhook: () =>
    new ConflictException({ code: PAYMENT_ERROR_CODES.DUPLICATE_WEBHOOK, message: 'This webhook event was already processed.' }),

  idempotencyConflict: () =>
    new ConflictException({ code: PAYMENT_ERROR_CODES.IDEMPOTENCY_CONFLICT, message: 'A payment with this idempotency key is already in progress.' }),

  forbiddenOwnership: () =>
    new ForbiddenException({ code: PAYMENT_ERROR_CODES.FORBIDDEN_OWNERSHIP, message: 'You do not have access to this payment.' }),

  amountMismatch: () =>
    new BadRequestException({ code: PAYMENT_ERROR_CODES.AMOUNT_MISMATCH, message: 'Reported payment amount does not match the expected amount.' }),
} as const;
