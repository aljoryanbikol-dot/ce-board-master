import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SolutionService } from '../services/solution.service';

function mocks() {
  const prisma = { question: { findFirst: vi.fn().mockResolvedValue({ id: 'q-1', questionCode: 'Q1', subjectId: 's-1', topicId: 't-1', stemText: 'stem', correctChoice: 'B', explanationText: 'expl', questionStatus: 'published' }) } };
  const context = { build: vi.fn().mockResolvedValue({ learningObjectives: [{ publicId: 'LO-1', statement: 'x' }], formulas: [{ id: 'f-1', name: 'F', expression: 'a=b' }], misconceptions: [] }), citationsFromContext: vi.fn().mockReturnValue([{ kind: 'formula', refId: 'f-1', label: 'F' }]) };
  const provider = { respond: vi.fn(), solve: vi.fn().mockResolvedValue({ steps: ['s1', 's2', 's3'], finalAnswer: 'Choice B', tokensIn: 1, tokensOut: 1 }) };
  const events = { emit: vi.fn() };
  return { prisma, context, provider, events, svc: new SolutionService(prisma as never, context as never, provider as never, events as never) };
}

describe('SolutionService', () => {
  let m: ReturnType<typeof mocks>;
  beforeEach(() => { m = mocks(); });

  it('produces ordered steps + final answer + citations', async () => {
    const r = await m.svc.solve('u-1', 'q-1');
    expect(r.steps).toHaveLength(3);
    expect(r.steps[0]!.order).toBe(1);
    expect(r.finalAnswer).toBe('Choice B');
    expect(r.citations.some((c) => c.kind === 'question')).toBe(true);
    expect(m.events.emit).toHaveBeenCalledWith(expect.stringContaining('solution.given'), expect.any(Object));
  });

  it('rejects an unpublished question', async () => {
    m.prisma.question.findFirst.mockResolvedValue({ id: 'q-1', questionStatus: 'draft' });
    await expect(m.svc.solve('u-1', 'q-1')).rejects.toThrow(BadRequestException);
  });

  it('throws on a missing question', async () => {
    m.prisma.question.findFirst.mockResolvedValue(null);
    await expect(m.svc.solve('u-1', 'q-1')).rejects.toThrow(NotFoundException);
  });
});
