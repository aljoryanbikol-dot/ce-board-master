import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FormulaAssistantService } from '../services/formula-assistant.service';

function mocks() {
  const prisma = { formulaLibrary: { findMany: vi.fn().mockResolvedValue([{ id: 'f-1', name: "Ohm's Law", expressionText: 'V=IR', expressionLatex: 'V=IR', subjectId: 's-1' }]) } };
  const context = { build: vi.fn().mockResolvedValue({ subjectId: 's-1', topicId: null, learningObjectives: [], formulas: [], misconceptions: [] }), citationsFromContext: vi.fn().mockReturnValue([]) };
  const provider = { respond: vi.fn().mockResolvedValue({ content: 'Use Ohm\'s Law', followUps: [], tokensIn: 1, tokensOut: 1 }), solve: vi.fn() };
  return { prisma, context, provider, svc: new FormulaAssistantService(prisma as never, context as never, provider as never) };
}

describe('FormulaAssistantService', () => {
  let m: ReturnType<typeof mocks>;
  beforeEach(() => { m = mocks(); });

  it('returns matching formulas + grounded guidance', async () => {
    const r = await m.svc.assist('ohm', { subjectId: 's-1' });
    expect(r.formulas).toHaveLength(1);
    expect(r.formulas[0]!.expression).toBe('V=IR');
    expect(r.guidance).toContain('Ohm');
  });

  it('reflects the found formulas into the provider context', async () => {
    await m.svc.assist('ohm', {});
    const ctxArg = m.provider.respond.mock.calls[0]![0].context;
    expect(ctxArg.formulas.length).toBeGreaterThan(0);
  });

  it('returns empty formulas when nothing matches', async () => {
    m.prisma.formulaLibrary.findMany.mockResolvedValue([]);
    const r = await m.svc.assist('nonexistent', {});
    expect(r.formulas).toHaveLength(0);
  });
});
