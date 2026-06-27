/**
 * @file email.service.ts
 * @module Auth/Services
 *
 * Transactional email delivery for all authentication flows.
 *
 * Uses Resend (https://resend.com) for reliable transactional email.
 * All emails are enqueued via BullMQ and delivered asynchronously
 * so the API request returns immediately without waiting for delivery.
 *
 * Emails sent by this module:
 * - Email verification link  (24-hour expiry)
 * - Password reset link      (1-hour expiry)
 * - Password changed notice  (security alert)
 * - Login from new device    (security alert, Phase 3)
 *
 * Template design: plain HTML with inline styles for maximum email
 * client compatibility. Each template includes the PRC independence
 * notice per Project Constitution Article VIII §8.1.
 *
 * @see Project Constitution Article XVII — Notification System
 * @see Queue jobs in QueueModule (QUEUE_NAMES.EMAIL)
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../../queue/queue.module';
import type { AppEnvironment } from '../../config/configuration';

// ── Email job payload types ───────────────────────────────────────────────────

export interface VerificationEmailPayload {
  type: 'verification';
  to: string;
  firstName: string;
  verificationUrl: string;
}

export interface PasswordResetEmailPayload {
  type: 'password_reset';
  to: string;
  firstName: string;
  resetUrl: string;
}

export interface PasswordChangedEmailPayload {
  type: 'password_changed';
  to: string;
  firstName: string;
  changedAt: string;
}

export type EmailJobPayload =
  | VerificationEmailPayload
  | PasswordResetEmailPayload
  | PasswordChangedEmailPayload;

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly frontendUrl: string;
  private readonly emailFrom: string;
  private readonly emailFromName: string;

  constructor(
    private readonly config: ConfigService<AppEnvironment>,
    @InjectQueue(QUEUE_NAMES.EMAIL) private readonly emailQueue: Queue,
  ) {
    this.frontendUrl = config.get('FRONTEND_URL', { infer: true })!;
    this.emailFrom = config.get('EMAIL_FROM', { infer: true })!;
    this.emailFromName = config.get('EMAIL_FROM_NAME', { infer: true })!;
  }

  /**
   * Queue a verification email after registration.
   * The raw token is embedded in the link as a query parameter.
   * Link format: {frontendUrl}/auth/verify-email?token={rawToken}
   *
   * @param to - Recipient email address
   * @param firstName - Recipient first name for personalisation
   * @param rawToken - The raw (un-hashed) verification token
   */
  async sendVerificationEmail(
    to: string,
    firstName: string,
    rawToken: string,
  ): Promise<void> {
    const verificationUrl = `${this.frontendUrl}/auth/verify-email?token=${rawToken}`;

    const payload: VerificationEmailPayload = {
      type: 'verification',
      to,
      firstName,
      verificationUrl,
    };

    await this.emailQueue.add('send-email', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
      // Deduplicate: one email per token (resends get a new token, new job)
      jobId: `verify-${rawToken.substring(0, 16)}`,
    });

    this.logger.log({
      message: 'Verification email queued',
      to,
      firstName,
    });
  }

  /**
   * Queue a password reset email.
   * Link format: {frontendUrl}/auth/reset-password?token={rawToken}
   *
   * @param to - Recipient email address
   * @param firstName - Recipient first name
   * @param rawToken - The raw (un-hashed) password reset token
   */
  async sendPasswordResetEmail(
    to: string,
    firstName: string,
    rawToken: string,
  ): Promise<void> {
    const resetUrl = `${this.frontendUrl}/auth/reset-password?token=${rawToken}`;

    const payload: PasswordResetEmailPayload = {
      type: 'password_reset',
      to,
      firstName,
      resetUrl,
    };

    await this.emailQueue.add('send-email', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
      jobId: `reset-${rawToken.substring(0, 16)}`,
    });

    this.logger.log({
      message: 'Password reset email queued',
      to,
      firstName,
    });
  }

  /**
   * Queue a security notice email after a successful password change.
   * Alerts the user so they can take action if the change was unauthorised.
   */
  async sendPasswordChangedEmail(
    to: string,
    firstName: string,
  ): Promise<void> {
    const payload: PasswordChangedEmailPayload = {
      type: 'password_changed',
      to,
      firstName,
      changedAt: new Date().toISOString(),
    };

    await this.emailQueue.add('send-email', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
    });

    this.logger.log({
      message: 'Password changed notification queued',
      to,
    });
  }
}
