/**
 * @file misconception.service.spec.ts
 * @module Misconceptions/Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { MisconceptionService } from '../services/misconception.service';
import { PublicIdService } from '../../knowledge/services/public-id.service';
import { ValidationEngineService } from '../../knowledge/services/validation-engine.service';

const user = { id: 'u-1', email: 'a@b.com', role: 'content_admin', subscriptionTier: 'pro' as const };
const mockPrisma = { misconception: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() } };
const mockCache = { invalidatePattern: vi.fn() };
const mockEvents = { emit: vi.fn() };

const mcRow = {
  id: 'mc-1', publicId: 'MC-STR-003-002-FRM-001', subjectCode: 'STR', topicCode: '003', subtopicCode: '002',
  category: 'FRM', sequenceNumber: 1, title: 'Stress vs strain', description: 'Applying stress formula for strain.',
  whyItHappens: null, correction: null, primaryObjectiveId: null, status: 'draft', currentVersion: 1, semver: '1.0.0',
  createdAt: new Date(), updatedAt: new Date(),
};

const build = () => new MisconceptionService(mockPrisma as never, mockCache as never, new PublicIdService(), new ValidationEngineService(new PublicIdService()), mockEvents as never);

describe('MisconceptionService', () => {
  let svc: MisconceptionService;
  beforeEach(() => { vi.clearAllMocks(); svc = build(); });

  it('creates a misconception with a valid MC id', async () => {
    mockPrisma.misconception.findUnique.mockResolvedValue(null);
    mockPrisma.misconception.create.mockResolvedValue(mcRow);
    const result = await svc.create({ subjectCode: 'STR', topicCode: 3, subtopicCode: 2, category: 'FRM', sequenceNumber: 1, title: 'Stress vs strain', description: 'Applying stress formula for strain.' } as never, user);
    expect(result.publicId).toBe('MC-STR-003-002-FRM-001');
    expect(mockEvents.emit).toHaveBeenCalledWith('knowledge.misconception.created', expect.anything());
  });

  it('rejects an invalid category', async () => {
    const err = await svc.create({ subjectCode: 'STR', topicCode: 3, subtopicCode: 2, category: 'ZZZ', sequenceNumber: 1, title: 'X', description: 'A detailed description here.' } as never, user).catch((e) => e);
    expect(err).toBeInstanceOf(UnprocessableEntityException);
    expect(err.getResponse().code).toBe('VALIDATION_FAILED');
  });

  it('rejects a duplicate public ID', async () => {
    mockPrisma.misconception.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(svc.create({ subjectCode: 'STR', topicCode: 3, subtopicCode: 2, category: 'FRM', sequenceNumber: 1, title: 'Stress vs strain', description: 'Applying stress formula for strain.' } as never, user)).rejects.toThrow(ConflictException);
  });

  it('publishes only when approved', async () => {
    mockPrisma.misconception.findFirst.mockResolvedValue({ status: 'draft' });
    await expect(svc.publish('mc-1', user)).rejects.toThrow(UnprocessableEntityException);
    mockPrisma.misconception.findFirst.mockResolvedValue({ status: 'approved' });
    mockPrisma.misconception.update.mockResolvedValue({ ...mcRow, status: 'published' });
    const r = await svc.publish('mc-1', user);
    expect(r.status).toBe('published');
  });

  it('search returns a page', async () => {
    mockPrisma.misconception.findMany.mockResolvedValue([mcRow]);
    mockPrisma.misconception.count.mockResolvedValue(1);
    const result = await svc.search({ category: 'FRM', limit: 20 } as never);
    expect(result.data).toHaveLength(1);
  });
});
