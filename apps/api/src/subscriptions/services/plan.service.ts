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
import {
  PLAN_CACHE_KEY, PLAN_CACHE_TTL,
  FREE_PLAN_LIMITS_CACHE_KEY, FREE_PLAN_LIMITS_CACHE_TTL, FALLBACK_FREE_TIER_LIMITS,
} from '../subscriptions.constants';
import { SubscriptionErrors } from '../subscriptions.errors';
import type { CreatePlanDto, UpdatePlanDto } from '../dto/plan.dto';

export interface FreeTierLimits {
  maxQuestions: number;
  maxMockExams: number;
  contentPreviewItems: number;
}

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

  /**
   * The Free plan's usage caps, read from its `limits` JSONB column — the
   * single configurable source of truth for FeatureAccessService. Cached
   * alongside the plan list; falls back to FALLBACK_FREE_TIER_LIMITS only if
   * no `free` plan row exists yet or its `limits` column is null.
   */
  async getFreeTierLimits(): Promise<FreeTierLimits> {
    return this.cache.remember(FREE_PLAN_LIMITS_CACHE_KEY, FREE_PLAN_LIMITS_CACHE_TTL, async () => {
      const plan = await this.prisma.subscriptionPlan.findFirst({
        where: { tier: SubscriptionTier.free, isActive: true, deletedAt: null },
        orderBy: { sortOrder: 'asc' },
        select: { limits: true },
      });
      const limits = plan?.limits as Partial<FreeTierLimits> | null | undefined;
      return {
        maxQuestions: limits?.maxQuestions ?? FALLBACK_FREE_TIER_LIMITS.maxQuestions,
        maxMockExams: limits?.maxMockExams ?? FALLBACK_FREE_TIER_LIMITS.maxMockExams,
        contentPreviewItems: limits?.contentPreviewItems ?? FALLBACK_FREE_TIER_LIMITS.contentPreviewItems,
      };
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
        name:            dto.name,
        slug:            dto.slug,
        tier:            dto.tier as SubscriptionTier,
        interval:        dto.interval as PlanInterval,
        priceMinor:      dto.priceMinor,
        currency:        dto.currency,
        durationDays:    dto.durationDays ?? null,
        fixedExpiryDate: dto.fixedExpiryDate ?? null,
        trialDays:       dto.trialDays,
        features:        dto.features as unknown as Prisma.InputJsonValue,
        limits:          (dto.limits ?? null) as unknown as Prisma.InputJsonValue,
        sortOrder:       dto.sortOrder,
        isActive:        true,
      },
    });
    await this.invalidateCaches();
    this.logger.log({ message: 'Plan created', slug: dto.slug });
    return this.toDto(plan);
  }

  async update(id: string, dto: UpdatePlanDto) {
    const existing = await this.prisma.subscriptionPlan.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw SubscriptionErrors.planNotFound(id);

    const plan = await this.prisma.subscriptionPlan.update({
      where: { id },
      data: {
        ...(dto.name            !== undefined && { name: dto.name }),
        ...(dto.priceMinor      !== undefined && { priceMinor: dto.priceMinor }),
        ...(dto.durationDays    !== undefined && { durationDays: dto.durationDays }),
        ...(dto.fixedExpiryDate !== undefined && { fixedExpiryDate: dto.fixedExpiryDate }),
        ...(dto.features        !== undefined && { features: dto.features as unknown as Prisma.InputJsonValue }),
        ...(dto.limits          !== undefined && { limits: dto.limits as unknown as Prisma.InputJsonValue }),
        ...(dto.trialDays       !== undefined && { trialDays: dto.trialDays }),
        ...(dto.isActive        !== undefined && { isActive: dto.isActive }),
        ...(dto.sortOrder       !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
    await this.invalidateCaches();
    this.logger.log({ message: 'Plan updated', id });
    return this.toDto(plan);
  }

  async softDelete(id: string): Promise<void> {
    const existing = await this.prisma.subscriptionPlan.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw SubscriptionErrors.planNotFound(id);
    await this.prisma.subscriptionPlan.update({
      where: { id }, data: { deletedAt: new Date(), isActive: false },
    });
    await this.invalidateCaches();
    this.logger.warn({ message: 'Plan soft-deleted', id });
  }

  private async invalidateCaches(): Promise<void> {
    await Promise.all([this.cache.del(PLAN_CACHE_KEY), this.cache.del(FREE_PLAN_LIMITS_CACHE_KEY)]);
  }

  private toDto(p: {
    id: string; name: string; slug: string; tier: string; interval: string;
    priceMinor: number; currency: string; durationDays: number | null;
    fixedExpiryDate?: Date | null; trialDays: number; features: unknown;
    limits?: unknown; isActive: boolean;
  }) {
    return {
      id: p.id, name: p.name, slug: p.slug, tier: p.tier, interval: p.interval,
      priceMinor: p.priceMinor, currency: p.currency, durationDays: p.durationDays,
      fixedExpiryDate: p.fixedExpiryDate?.toISOString() ?? null,
      trialDays: p.trialDays, features: (p.features as string[]) ?? [],
      limits: (p.limits as Record<string, number> | null) ?? null, isActive: p.isActive,
    };
  }
}
