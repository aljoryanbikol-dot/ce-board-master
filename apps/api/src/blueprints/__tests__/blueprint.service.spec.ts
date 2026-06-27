/**
 * @file blueprint.service.spec.ts
 * @module Blueprints/Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { BlueprintService } from '../services/blueprint.service';
import { PublicIdService } from '../../knowledge/services/public-id.service';
import { ValidationEngineService } from '../../knowledge/services/validation-engine.service';

const user = { id: 'u-1', email: 'a@b.com', role: 'content_admin', subscriptionTier: 'pro' as const };
const mockPrisma = { questionBlueprint: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() } };
const mockCache = { invalidatePattern: vi.fn() };
const mockEvents = { emit: vi.fn() };

const bpRow = {
  id: 'bp-1', publicId: 'BP-STR-004-002-CMP-001', subjectCode: 'STR', topicCode: '004', subtopicCode: '002',
  blueprintType: 'CMP', sequenceNumber: 1, name: 'Axial stress', description: null, primaryObjectiveId: null,
  structure: {}, difficultyBand: null, status: 'draft', currentVersion: 1, semver: '1.0.0', createdAt: new Date(), updatedAt: new Date(),
};

const build = () => new BlueprintService(mockPrisma as never, mockCache as never, new PublicIdService(), new ValidationEngineService(new PublicIdService()), mockEvents as never);

describe('BlueprintService', () => {
  let svc: BlueprintService;
  beforeEach(() => { vi.clearAllMocks(); svc = build(); });

  it('creates a blueprint with a valid BP id', async () => {
    mockPrisma.questionBlueprint.findUnique.mockResolvedValue(null);
    mockPrisma.questionBlueprint.create.mockResolvedValue(bpRow);
    const result = await svc.create({ subjectCode: 'STR', topicCode: 4, subtopicCode: 2, blueprintType: 'CMP', sequenceNumber: 1, name: 'Axial stress', structure: {} } as never, user);
    expect(result.publicId).toBe('BP-STR-004-002-CMP-001');
    expect(mockEvents.emit).toHaveBeenCalledWith('knowledge.blueprint.created', expect.anything());
  });

  it('rejects an invalid blueprint type', async () => {
    const err = await svc.create({ subjectCode: 'STR', topicCode: 4, subtopicCode: 2, blueprintType: 'XXX', sequenceNumber: 1, name: 'Axial stress', structure: {} } as never, user).catch((e) => e);
    expect(err).toBeInstanceOf(UnprocessableEntityException);
    expect(err.getResponse().code).toBe('VALIDATION_FAILED');
  });

  it('rejects a duplicate public ID', async () => {
    mockPrisma.questionBlueprint.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(svc.create({ subjectCode: 'STR', topicCode: 4, subtopicCode: 2, blueprintType: 'CMP', sequenceNumber: 1, name: 'Axial stress', structure: {} } as never, user)).rejects.toThrow(ConflictException);
  });

  it('refuses to publish a non-approved blueprint', async () => {
    mockPrisma.questionBlueprint.findFirst.mockResolvedValue({ status: 'draft' });
    await expect(svc.publish('bp-1', user)).rejects.toThrow(UnprocessableEntityException);
  });

  it('publishes an approved blueprint', async () => {
    mockPrisma.questionBlueprint.findFirst.mockResolvedValue({ status: 'approved' });
    mockPrisma.questionBlueprint.update.mockResolvedValue({ ...bpRow, status: 'published' });
    const r = await svc.publish('bp-1', user);
    expect(r.status).toBe('published');
  });

  it('search returns a page', async () => {
    mockPrisma.questionBlueprint.findMany.mockResolvedValue([bpRow]);
    mockPrisma.questionBlueprint.count.mockResolvedValue(1);
    const result = await svc.search({ blueprintType: 'CMP', limit: 20 } as never);
    expect(result.data).toHaveLength(1);
  });
});
