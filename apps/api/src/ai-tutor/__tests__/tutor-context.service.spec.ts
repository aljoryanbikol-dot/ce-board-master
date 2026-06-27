/**
 * @file tutor-context.service.spec.ts
 * @module AITutor/Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TutorContextService } from '../services/tutor-context.service';

function mocks() {
  const prisma = {
    subject: { findUnique: vi.fn().mockResolvedValue({ code: 'MAT' }) },
    learningObjective: { findMany: vi.fn().mockResolvedValue([{ publicId: 'LO-MAT-1', statement: 'Understand limits' }]) },
    formulaLibrary: { findMany: vi.fn().mockResolvedValue([{ id: 'f-1', name: 'Quadratic', expressionText: 'x=(-b±√(b²-4ac))/2a' }]) },
    misconception: { findMany: vi.fn().mockResolvedValue([{ publicId: 'MIS-1', title: 'Sign flip', description: 'flips signs' }]) },
  };
  const cache = { remember: vi.fn((_k: string, _t: number, fn: () => unknown) => fn()) };
  return { prisma, cache, svc: new TutorContextService(prisma as never, cache as never) };
}

describe('TutorContextService', () => {
  let m: ReturnType<typeof mocks>;
  beforeEach(() => { m = mocks(); });

  it('assembles LO + formula + misconception context for a subject', async () => {
    const ctx = await m.svc.build({ subjectId: 's-1', topicId: 't-1' });
    expect(ctx.learningObjectives).toHaveLength(1);
    expect(ctx.formulas[0]!.expression).toContain('x=');
    expect(ctx.misconceptions[0]!.title).toBe('Sign flip');
    expect(m.cache.remember).toHaveBeenCalled();
  });

  it('returns an empty context when no subject is given', async () => {
    const ctx = await m.svc.build({ subjectId: null, topicId: null });
    expect(ctx.learningObjectives).toHaveLength(0);
    expect(ctx.formulas).toHaveLength(0);
  });

  it('carries memory + recent turns through', async () => {
    const ctx = await m.svc.build({ subjectId: 's-1', topicId: null, memorySummary: 'prior summary', recentTurns: [{ role: 'user', content: 'hi' }] });
    expect(ctx.memorySummary).toBe('prior summary');
    expect(ctx.recentTurns).toHaveLength(1);
  });

  it('builds citations from a context (capped, typed)', () => {
    const cites = m.svc.citationsFromContext({
      subjectId: 's-1', topicId: 't-1',
      learningObjectives: [{ publicId: 'LO-1', statement: 'x' }],
      formulas: [{ id: 'f-1', name: 'F', expression: 'a=b' }],
      misconceptions: [{ publicId: 'MIS-1', title: 'M', description: 'd' }],
      memorySummary: null, recentTurns: [],
    });
    expect(cites.some((c) => c.kind === 'learning_objective')).toBe(true);
    expect(cites.some((c) => c.kind === 'formula')).toBe(true);
    expect(cites.some((c) => c.kind === 'misconception')).toBe(true);
  });

  it('tolerates a missing misconception table (catch → empty)', async () => {
    m.prisma.misconception.findMany.mockRejectedValue(new Error('no table'));
    const ctx = await m.svc.build({ subjectId: 's-1', topicId: null });
    expect(ctx.misconceptions).toHaveLength(0);
  });
});
