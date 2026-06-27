import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ExplanationService } from '../services/explanation.service';

function mocks() {
  const prisma = { question: { findFirst: vi.fn().mockResolvedValue({ id: 'q-1', questionCode: 'Q1', subjectId: 's-1', topicId: 't-1', stemText: 'stem', correctChoice: 'A', explanationText: 'expl', questionStatus: 'published' }) } };
  const context = { build: vi.fn().mockResolvedValue({ learningObjectives: [{ publicId: 'LO-1', statement: 'x' }], formulas: [], misconceptions: [] }), citationsFromContext: vi.fn().mockReturnValue([{ kind: 'learning_objective', refId: 'LO-1', label: 'x' }]) };
  const grounding = { validate: vi.fn().mockReturnValue({ ok: true, reasons: [] }) };
  const provider = { respond: vi.fn().mockResolvedValue({ content: 'explanation', followUps: ['fu'], tokensIn: 1, tokensOut: 2 }), solve: vi.fn() };
  const events = { emit: vi.fn() };
  return { prisma, context, grounding, provider, events, svc: new ExplanationService(prisma as never, context as never, grounding as never, provider as never, events as never) };
}

describe('ExplanationService', () => {
  let m: ReturnType<typeof mocks>;
  beforeEach(() => { m = mocks(); });

  it('explains a concept with citations + grounding', async () => {
    const r = await m.svc.explainConcept('equilibrium', {});
    expect(r.content).toBe('explanation');
    expect(r.citations.length).toBeGreaterThan(0);
    expect(m.events.emit).toHaveBeenCalledWith(expect.stringContaining('validated'), expect.any(Object));
  });

  it('explains a published question and adds a question citation', async () => {
    const r = await m.svc.explainQuestion('q-1');
    expect(r.questionId).toBe('q-1');
    expect(r.citations.some((c) => c.kind === 'question')).toBe(true);
  });

  it('rejects an unpublished question', async () => {
    m.prisma.question.findFirst.mockResolvedValue({ id: 'q-1', questionStatus: 'draft' });
    await expect(m.svc.explainQuestion('q-1')).rejects.toThrow(BadRequestException);
  });

  it('throws on a missing question', async () => {
    m.prisma.question.findFirst.mockResolvedValue(null);
    await expect(m.svc.explainQuestion('q-1')).rejects.toThrow(NotFoundException);
  });
});
