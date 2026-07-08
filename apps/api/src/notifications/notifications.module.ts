/**
 * @file notifications.module.ts
 * @module Notifications
 *
 * NotificationsModule — registers the workers that consume the async
 * notification queues (see QueueModule, which registers the queues
 * themselves). Currently: the transactional email worker (Resend).
 */
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '../queue/queue.module';
import { EmailProcessor } from './email.processor';

@Module({
  // The queue registration must be imported in the SAME module as the
  // @Processor provider — BullMQ's explorer only attaches workers to queues
  // registered in the consumer's own module context. Registering the name a
  // second time here is idempotent (QueueModule registers it for producers).
  imports: [BullModule.registerQueue({ name: QUEUE_NAMES.EMAIL })],
  providers: [EmailProcessor],
})
export class NotificationsModule {}
