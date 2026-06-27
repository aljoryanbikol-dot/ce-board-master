import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LearningPathService } from '../services/learning-path.service';

function mocks() {
  const prisma = {
    knowledgeGap: { findMany: vi.fn().mockResolvedValue([{ topicId: 't-1', subjectId: 's-1', accuracy: 0.3, severity: 'critical' }]) },
    learningPath: { updateMany: vi.fn().mockResolvedValue({}), create: vi.fn().mockResolvedValue({ id: 'lp-1', title: 'Path' }), findFirst: vi.fn() },
  };
  const progress = { detectKnowledgeGaps: vi.fn().mockResolvedValue([]) };
  const events = { emit: vi.fn() };
  return { prisma, progress, events, svc: new LearningPathService(prisma as never, progress as never, events as never) };
}

describe('LearningPathService', () => {
  let m: ReturnType<typeof mocks>;
  beforeEach(() => { m = mocks(); });

  it('generates an ordered path from gaps and deactivates prior paths', async () => {
    const result = await m.svc.generate('u-1');
    expect(m.progress.detectKnowledgeGaps).toHaveBeenCalled();
    expect(m.prisma.learningPath.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { isActive: false } }));
    expect(result.steps[0]!.order).toBe(1);
    expect(result.steps[0]!.topicId).toBe('t-1');
    expect(m.events.emit).toHaveBeenCalledWith(expect.stringContaining('path'), expect.any(Object));
  });

  it('returns null when there is no active path', async () => {
    m.prisma.learningPath.findFirst.mockResolvedValue(null);
    expect(await m.svc.getActive('u-1')).toBeNull();
  });

  it('returns the active path when present', async () => {
    m.prisma.learningPath.findFirst.mockResolvedValue({ id: 'lp-1', title: 'Path', steps: [], generatedAt: new Date() });
    const active = await m.svc.getActive('u-1');
    expect(active?.id).toBe('lp-1');
  });
});
