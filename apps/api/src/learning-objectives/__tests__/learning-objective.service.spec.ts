/**
 * @file learning-objective.service.spec.ts
 * @module LearningObjectives/Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { LearningObjectiveService } from '../services/learning-objective.service';
import { PublicIdService } from '../../knowledge/services/public-id.service';
import { ValidationEngineService } from '../../knowledge/services/validation-engine.service';

const user = { id: 'u-1', email: 'a@b.com', role: 'content_admin', subscriptionTier: 'pro' as const };

const tx = {
  learningObjective: { create: vi.fn(), update: vi.fn() },
  learningObjectiveVersion: { create: vi.fn(), updateMany: vi.fn() },
};
const mockPrisma = {
  learningObjective: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn() },
  learningObjectiveVersion: { findMany: vi.fn() },
  $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
};
const mockCache = { invalidatePattern: vi.fn() };
const mockEvents = { emit: vi.fn() };

const loRow = {
  id: 'lo-1', publicId: 'LO-STR-001-003-001', subjectCode: 'STR', topicCode: '001', subtopicCode: '003',
  sequenceNumber: 1, statement: 'Compute the normal stress in a member.', bloomLevel: 'apply', measurable: true,
  status: 'draft', currentVersion: 1, semver: '1.0.0', keywords: [], subjectId: null, createdAt: new Date(), updatedAt: new Date(),
};

const build = () => new LearningObjectiveService(mockPrisma as never, mockCache as never, new PublicIdService(), new ValidationEngineService(new PublicIdService()), mockEvents as never);

describe('LearningObjectiveService', () => {
  let svc: LearningObjectiveService;
  beforeEach(() => {
    vi.clearAllMocks();
    svc = build();
    tx.learningObjective.create.mockResolvedValue(loRow);
    tx.learningObjectiveVersion.create.mockResolvedValue({});
    tx.learningObjectiveVersion.updateMany.mockResolvedValue({});
  });

  describe('create', () => {
    it('builds the public ID, validates, and snapshots v1', async () => {
      mockPrisma.learningObjective.findUnique.mockResolvedValue(null);
      const result = await svc.create({ subjectCode: 'STR', topicCode: 1, subtopicCode: 3, sequenceNumber: 1, statement: 'Compute the normal stress in a member.', bloomLevel: 'apply', measurable: true, keywords: [] } as never, user);
      expect(result.publicId).toBe('LO-STR-001-003-001');
      expect(tx.learningObjectiveVersion.create).toHaveBeenCalled();
      expect(mockEvents.emit).toHaveBeenCalledWith('knowledge.lo.created', expect.anything());
    });

    it('rejects an invalid subject code via the validation engine', async () => {
      const err = await svc.create({ subjectCode: 'ZZZ', topicCode: 1, subtopicCode: 3, sequenceNumber: 1, statement: 'Compute the normal stress in a member.', bloomLevel: 'apply', measurable: true, keywords: [] } as never, user).catch((e) => e);
      expect(err).toBeInstanceOf(UnprocessableEntityException);
      expect(err.getResponse().code).toBe('VALIDATION_FAILED');
      expect(mockEvents.emit).toHaveBeenCalledWith('knowledge.validation.failed', expect.anything());
    });

    it('rejects a duplicate public ID', async () => {
      mockPrisma.learningObjective.findUnique.mockResolvedValue({ id: 'existing' });
      const err = await svc.create({ subjectCode: 'STR', topicCode: 1, subtopicCode: 3, sequenceNumber: 1, statement: 'Compute the normal stress in a member.', bloomLevel: 'apply', measurable: true, keywords: [] } as never, user).catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getResponse().code).toBe('PUBLIC_ID_TAKEN');
    });
  });

  describe('update', () => {
    it('bumps the version and snapshots', async () => {
      mockPrisma.learningObjective.findFirst.mockResolvedValue(loRow);
      tx.learningObjective.update.mockResolvedValue({ ...loRow, currentVersion: 2, semver: '1.1.0', statement: 'Updated statement here.' });
      const result = await svc.update('lo-1', { statement: 'Updated statement here.' } as never, user);
      expect(result.currentVersion).toBe(2);
      expect(tx.learningObjectiveVersion.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { isCurrent: false } }));
      expect(mockEvents.emit).toHaveBeenCalledWith('knowledge.lo.updated', expect.anything());
    });
  });

  describe('publish gate', () => {
    it('refuses to publish a draft', async () => {
      mockPrisma.learningObjective.findFirst.mockResolvedValue({ status: 'draft' });
      const err = await svc.publish('lo-1', user).catch((e) => e);
      expect(err).toBeInstanceOf(UnprocessableEntityException);
      expect(err.getResponse().code).toBe('NOT_PUBLISHABLE');
    });

    it('publishes an approved objective', async () => {
      mockPrisma.learningObjective.findFirst.mockResolvedValue({ status: 'approved' });
      mockPrisma.learningObjective.update.mockResolvedValue({ ...loRow, status: 'published' });
      const result = await svc.publish('lo-1', user);
      expect(result.status).toBe('published');
      expect(mockEvents.emit).toHaveBeenCalledWith('knowledge.lo.published', expect.anything());
    });
  });

  describe('lifecycle transitions', () => {
    it('submitForReview requires draft', async () => {
      mockPrisma.learningObjective.findFirst.mockResolvedValue({ status: 'published' });
      await expect(svc.submitForReview('lo-1')).rejects.toThrow(UnprocessableEntityException);
    });
    it('approve requires in_review', async () => {
      mockPrisma.learningObjective.findFirst.mockResolvedValue({ status: 'in_review' });
      mockPrisma.learningObjective.update.mockResolvedValue({ ...loRow, status: 'approved' });
      const r = await svc.approve('lo-1');
      expect(r.status).toBe('approved');
    });
  });

  describe('search', () => {
    it('returns a cursor page', async () => {
      mockPrisma.learningObjective.findMany.mockResolvedValue([loRow]);
      mockPrisma.learningObjective.count.mockResolvedValue(1);
      const result = await svc.search({ subjectCode: 'STR', limit: 20 } as never);
      expect(result.data).toHaveLength(1);
      expect(result.pagination.hasMore).toBe(false);
    });
  });
});
