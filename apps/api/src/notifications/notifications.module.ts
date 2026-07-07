/**
 * @file notifications.module.ts
 * @module Notifications
 *
 * NotificationsModule — registers the workers that consume the async
 * notification queues (see QueueModule, which registers the queues
 * themselves). Currently: the transactional email worker (Resend).
 */
import { Module } from '@nestjs/common';
import { EmailProcessor } from './email.processor';

@Module({
  providers: [EmailProcessor],
})
export class NotificationsModule {}
