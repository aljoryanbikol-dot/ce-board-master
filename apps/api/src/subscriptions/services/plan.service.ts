/**
 * @file plan.service.ts
 * @module Subscriptions/Services
 *
 * PlanService — CRUD for subscription plans (admin) and public plan listing.
 * Plans rarely change, so the public list is cached for 1 hour and invalidated
 * on any mutation.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PlanInterval, SubscriptionTier, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { PLAN_CACHE_KEY, PLAN_CACHE_TTL } from '../subscriptions.constants';
import { SubscriptionErrors } from '../subscriptions.errors';
import type { CreatePlanDto, UpdatePlanDto } from '../dto/plan.dto';

@Injectable()
export class PlanService {
  private readonly logger = new Logger(PlanService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async listActive() {
    return this.cache.remember(PLAN_CACHE_KEY, PLAN_CACHE_TTL, async () => {
      const plans = await this.prisma.subscriptionPlan.findMany({
        where:   { isActive: true, deletedAt: null },
        orderBy: { sortOrder: 'asc' },
      });
      return plans.map((p: Parameters<typeof this.toDto>[0]) => this.toDto(p));
    });
  }

  async getById(id: string) {
    const plan = await this.prisma.subscriptionPlan.findFirst({ where: { id, deletedAt: null } });
    if (!plan) throw SubscriptionErrors.planNotFound(id);
    return this.toDto(plan);
  }

  /** Internal: returns the raw plan row (used by SubscriptionService). */
  async getRawById(id: string) {
    const plan = await this.prisma.subscriptionPlan.findFirst({ where: { id, deletedAt: null } });
    if (!plan) throw SubscriptionErrors.planNotFound(id);
    return plan;
  }

  async create(dto: CreatePlanDto) {
    const existing = await this.prisma.subscriptionPlan.findUnique({ where: { slug: dto.slug }, select: { id: true } });
    if (existing) throw SubscriptionErrors.duplicatePlanSlug(dto.slug);

    const plan = await this.prisma.subscriptionPlan.create({
      data: {
        name:         dto.name,
        slug:         dto.slug,
        tier:         dto.tier as SubscriptionTier,
        interval:     dto.interval as PlanInterval,
        priceMinor:   dto.priceMinor,
        currency:     dto.currency,
        durationDays: dto.durationDays ?? null,
        trialDays:    dto.trialDays,
        features:     dto.features as unknown as Prisma.InputJsonValue,
        sortOrder:    dto.sortOrder,
        isActive:     true,
      },
    });
    await this.cache.del(PLAN_CACHE_KEY);
    this.logger.log({ message: 'Plan created', slug: dto.slug });
    return this.toDto(plan);
  }

  async update(id: string, dto: UpdatePlanDto) {
    const existing = await this.prisma.subscriptionPlan.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw SubscriptionErrors.planNotFound(id);

    const plan = await this.prisma.subscriptionPlan.update({
      where: { id },
      data: {
        ...(dto.name       !== undefined && { name: dto.name }),
        ...(dto.priceMinor !== undefined && { priceMinor: dto.priceMinor }),
        ...(dto.features   !== undefined && { features: dto.features as unknown as Prisma.InputJsonValue }),
        ...(dto.trialDays  !== undefined && { trialDays: dto.trialDays }),
        ...(dto.isActive   !== undefined && { isActive: dto.isActive }),
        ...(dto.sortOrder  !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
    await this.cache.del(PLAN_CACHE_KEY);
    this.logger.log({ message: 'Plan updated', id });
    return this.toDto(plan);
  }

  async softDelete(id: string): Promise<void> {
    const existing = await this.prisma.subscriptionPlan.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw SubscriptionErrors.planNotFound(id);
    await this.prisma.subscriptionPlan.update({
      where: { id }, data: { deletedAt: new Date(), isActive: false },
    });
    await this.cache.del(PLAN_CACHE_KEY);
    this.logger.warn({ message: 'Plan soft-deleted', id });
  }

  private toDto(p: {
    id: string; name: string; slug: string; tier: string; interval: string;
    priceMinor: number; currency: string; durationDays: number | null;
    trialDays: number; features: unknown; isActive: boolean;
  }) {
    return {
      id: p.id, name: p.name, slug: p.slug, tier: p.tier, interval: p.interval,
      priceMinor: p.priceMinor, currency: p.currency, durationDays: p.durationDays,
      trialDays: p.trialDays, features: (p.features as string[]) ?? [], isActive: p.isActive,
    };
  }
}
