import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { HintService } from '../services/hint.service';

function mocks() {
  const prisma = { question: { findFirst: vi.fn().mockResolvedValue({ id: 'q-1', subjectId: 's-1', topicId: 't-1', stemText: 'stem', correctChoice: 'A', explanationText: 'expl', questionStatus: 'published' }) } };
  const context = { build: vi.fn().mockResolvedValue({ learningObjectives: [], formulas: [{ id: 'f-1', name: 'F', expression: 'a=b' }], misconceptions: [] }), citationsFromContext: vi.fn().mockReturnValue([{ kind: 'formula', refId: 'f-1', label: 'F' }]) };
  const provider = { respond: vi.fn().mockResolvedValue({ content: 'hint text', followUps: [], tokensIn: 1, tokensOut: 1 }), solve: vi.fn() };
  const events = { emit: vi.fn() };
  return { prisma, context, provider, events, svc: new HintService(prisma as never, context as never, provider as never, events as never) };
}

describe('HintService', () => {
  let m: ReturnType<typeof mocks>;
  beforeEach(() => { m = mocks(); });

  it('returns a level-1 hint by default with next level available', async () => {
    const r = await m.svc.hint('u-1', 'q-1');
    expect(r.level).toBe(1);
    expect(r.nextLevelAvailable).toBe(true);
    expect(m.events.emit).toHaveBeenCalledWith(expect.stringContaining('hint.given'), expect.any(Object));
  });

  it('clamps the level to the max (no next level at 3)', async () => {
    const r = await m.svc.hint('u-1', 'q-1', 9);
    expect(r.level).toBe(3);
    expect(r.nextLevelAvailable).toBe(false);
  });

  it('excludes question citations from hints', async () => {
    m.context.citationsFromContext.mockReturnValue([{ kind: 'question', refId: 'q-1', label: 'Q' }, { kind: 'formula', refId: 'f-1', label: 'F' }]);
    const r = await m.svc.hint('u-1', 'q-1');
    expect(r.citations.every((c) => c.kind !== 'question')).toBe(true);
  });

  it('rejects an unpublished question', async () => {
    m.prisma.question.findFirst.mockResolvedValue({ id: 'q-1', questionStatus: 'draft' });
    await expect(m.svc.hint('u-1', 'q-1')).rejects.toThrow(BadRequestException);
  });

  it('throws on a missing question', async () => {
    m.prisma.question.findFirst.mockResolvedValue(null);
    await expect(m.svc.hint('u-1', 'q-1')).rejects.toThrow(NotFoundException);
  });
});
