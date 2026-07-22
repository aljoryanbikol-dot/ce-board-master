/**
 * @file email.processor.ts
 * @module Notifications
 *
 * EmailProcessor — the consumer side of the transactional email pipeline.
 *
 * EmailService (auth module) enqueues typed payloads onto the 'email' BullMQ
 * queue; this worker renders the matching template and delivers it through
 * Resend's REST API. Until this processor existed, jobs were enqueued and
 * silently never sent — no verification, reset, or security emails reached
 * users.
 *
 * Delivery uses plain fetch against https://api.resend.com/emails (no SDK
 * dependency). Failures throw so BullMQ's retry policy (3 attempts,
 * exponential backoff — set by the enqueuer) applies. A missing RESEND_API_KEY
 * fails the job with an explicit, greppable error instead of pretending
 * delivery succeeded.
 *
 * Template design: plain HTML with inline styles for maximum email-client
 * compatibility, per the EmailService header contract.
 */
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue/queue.module';
import type { EmailJobPayload } from '../auth/services/email.service';
import type { AppEnvironment } from '../config/configuration';
import { httpFetch } from '../common/types/http-fetch.types';

const RESEND_API = 'https://api.resend.com/emails';

/** Shared shell so every email carries the same brand + compliance footer. */
function layout(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
          <tr><td style="background:#1d4ed8;padding:20px 32px;">
            <span style="color:#ffffff;font-size:18px;font-weight:bold;">CE Board Master</span>
          </td></tr>
          <tr><td style="padding:32px;">
            <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">${title}</h1>
            ${bodyHtml}
          </td></tr>
          <tr><td style="padding:20px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.5;">
              CE Board Master is an independent review platform and is not affiliated with,
              endorsed by, or connected to the Professional Regulation Commission (PRC).
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:24px 0;"><a href="${href}" style="background:#1d4ed8;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:bold;display:inline-block;">${label}</a></p>
<p style="font-size:12px;color:#6b7280;word-break:break-all;">If the button does not work, copy this link into your browser:<br>${href}</p>`;
}

function render(payload: EmailJobPayload): { subject: string; html: string } {
  switch (payload.type) {
    case 'verification':
      return {
        subject: 'Verify your email — CE Board Master',
        html: layout(
          `Welcome, ${payload.firstName}!`,
          `<p style="font-size:14px;line-height:1.6;">Thanks for creating your CE Board Master account. Confirm your email address to unlock practice, mock boards, and the AI tutor.</p>
           ${button(payload.verificationUrl, 'Verify my email')}
           <p style="font-size:12px;color:#6b7280;">This link expires in 24 hours. If you did not create this account, you can safely ignore this email.</p>`,
        ),
      };
    case 'password_reset':
      return {
        subject: 'Reset your password — CE Board Master',
        html: layout(
          `Password reset requested`,
          `<p style="font-size:14px;line-height:1.6;">Hi ${payload.firstName}, we received a request to reset your CE Board Master password.</p>
           ${button(payload.resetUrl, 'Reset my password')}
           <p style="font-size:12px;color:#6b7280;">This link expires in 1 hour. If you did not request this, ignore this email — your password will stay unchanged.</p>`,
        ),
      };
    case 'password_changed':
      return {
        subject: 'Your password was changed — CE Board Master',
        html: layout(
          `Password changed`,
          `<p style="font-size:14px;line-height:1.6;">Hi ${payload.firstName}, your CE Board Master password was changed on ${new Date(payload.changedAt).toUTCString()}.</p>
           <p style="font-size:14px;line-height:1.6;">If this was you, no action is needed. If you did not make this change, reset your password immediately and contact support.</p>`,
        ),
      };
    case 'gcash_instructions': {
      const amount = `₱${(payload.amountMinor / 100).toFixed(2)}`;
      return {
        subject: `Paano magbayad ng ${payload.planName} — CE Board Master`,
        html: layout(
          `Halos tapos ka na! Dalawang paraan para magbayad`,
          `<p style="font-size:14px;line-height:1.6;">Sinimulan mo ang pag-upgrade sa <strong>${payload.planName}</strong> (${amount}). Piliin ang mas madali para sa'yo:</p>
           <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:16px;margin:16px 0;">
             <p style="margin:0 0 8px;font-size:14px;font-weight:bold;">Option 1 — GCash send (pinakamabilis sa cellphone)</p>
             <p style="margin:0;font-size:14px;line-height:1.7;">
               I-send ang eksaktong <strong>${amount}</strong> sa GCash number na ito:<br>
               <span style="font-size:20px;font-weight:bold;letter-spacing:1px;">${payload.gcashNumber}</span> <span style="color:#6b7280;">(${payload.gcashLabel})</span><br>
               Pagkatapos, ilagay ang GCash Reference No. mo dito:
             </p>
             ${button(payload.subscriptionUrl, 'I-submit ang reference number')}
           </div>
           ${payload.checkoutUrl ? `<p style="font-size:14px;line-height:1.6;"><strong>Option 2 — Card / bank QR:</strong> ituloy ang secure checkout:</p>${button(payload.checkoutUrl, 'Ituloy ang checkout')}` : ''}
           <p style="font-size:12px;color:#6b7280;">Kapag na-verify ang bayad mo, awtomatikong maa-activate ang Premium mo.</p>`,
        ),
      };
    }
    case 'gcash_submitted':
      return {
        subject: 'Natanggap namin ang GCash payment mo — CE Board Master',
        html: layout(
          `Salamat! Vine-verify na ang bayad mo`,
          `<p style="font-size:14px;line-height:1.6;">Na-submit mo ang GCash payment para sa <strong>${payload.planName}</strong> (₱${(payload.amountMinor / 100).toFixed(2)}) na may Reference No. <strong style="font-family:monospace;">${payload.referenceNo}</strong>.</p>
           <p style="font-size:14px;line-height:1.6;">Ive-verify namin ito at awtomatikong maa-activate ang Premium mo — karaniwan sa loob ng ilang oras. Papadalhan ka namin ng email pagka-activate.</p>`,
        ),
      };
    case 'payment_approved':
      return {
        subject: 'Premium mo ay ACTIVE na! 🎉 — CE Board Master',
        html: layout(
          `Welcome to ${payload.planName}!`,
          `<p style="font-size:14px;line-height:1.6;">Na-verify na ang bayad mo at <strong>active na ang ${payload.planName} mo</strong>. Bukas na ang lahat: unlimited questions, 1,000 board simulations, ang buong Fundamentals Handbook, at unlimited AI Tutor.</p>
           ${button(payload.dashboardUrl, 'Simulan ang review')}
           <p style="font-size:12px;color:#6b7280;">Good luck sa board exam — kaya mo yan!</p>`,
        ),
      };
  }
}

@Processor(QUEUE_NAMES.EMAIL, { concurrency: 5 })
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly config: ConfigService<AppEnvironment>) {
    super();
  }

  onApplicationBootstrap(): void {
    // Greppable liveness marker: proves the worker attached to the queue.
    this.logger.log({ message: 'EmailProcessor attached to email queue', hasResendKey: !!this.config.get('RESEND_API_KEY', { infer: true }) });
  }

  async process(job: Job<EmailJobPayload>): Promise<void> {
    const payload = job.data;
    const apiKey = this.config.get('RESEND_API_KEY', { infer: true });
    if (!apiKey) {
      // Throwing keeps the job visible as failed (with retries) rather than
      // silently swallowing mail in environments missing the key.
      throw new Error('RESEND_API_KEY is not configured — cannot deliver email');
    }

    const from = `${this.config.get('EMAIL_FROM_NAME', { infer: true })} <${this.config.get('EMAIL_FROM', { infer: true })}>`;
    const { subject, html } = render(payload);

    // Typed locally rather than relying on the ambient fetch/Response types:
    // which lib supplies them differs between the local @types/node and the
    // toolchain the deploy platform resolves, and that mismatch broke the
    // build while the same code compiled fine on a developer machine.
    const res = await httpFetch(RESEND_API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [payload.to], subject, html }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => `HTTP ${res.status}`);
      this.logger.error({ message: 'Resend delivery failed', type: payload.type, to: payload.to, status: res.status, detail: detail.slice(0, 300) });
      throw new Error(`Resend delivery failed (${res.status})`);
    }

    const body = (await res.json()) as { id?: string };
    this.logger.log({ message: 'Email delivered', type: payload.type, to: payload.to, resendId: body.id });
  }
}
