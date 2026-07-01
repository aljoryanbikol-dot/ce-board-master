/**
 * @file ai-tutor.service.spec.ts
 * @module AITutor/Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { AITutorService } from '../services/ai-tutor.service';

const ctxValue = {
  subjectId: 's-1', topicId: 't-1',
  learningObjectives: [{ publicId: 'LO-1', statement: 'equilibrium' }],
  formulas: [{ id: 'f-1', name: "Ohm's Law", expression: 'V=IR' }],
  misconceptions: [{ publicId: 'MIS-1', title: 'Sign Error', description: 'flips signs' }],
  memorySummary: null, recentTurns: [],
};

function mocks() {
  const conversations = {
    create: vi.fn().mockResolvedValue({ id: 'c-1', title: 'T' }),
    getOwned: vi.fn().mockResolvedValue({ id: 'c-1', userId: 'u-1', status: 'active', subjectId: 's-1', topicId: 't-1', memorySummary: null }),
    appendUserMessage: vi.fn().mockResolvedValue({ id: 'um-1' }),
    appendAssistantMessage: vi.fn().mockResolvedValue({ id: 'am-1' }),
    recentTurns: vi.fn().mockResolvedValue([]),
  };
  const context = { build: vi.fn().mockResolvedValue({ ...ctxValue }), citationsFromContext: vi.fn().mockReturnValue([{ kind: 'formula', refId: 'f-1', label: "Ohm's Law" }]) };
  const explanation = { explainQuestion: vi.fn().mockResolvedValue({ content: 'expl', citations: [], followUps: [], groundedInKb: true }), explainConcept: vi.fn().mockResolvedValue({ content: 'concept', citations: [], followUps: [], groundedInKb: true }) };
  const solution = { solve: vi.fn().mockResolvedValue({ questionId: 'q-1', steps: [{ order: 1, text: 'step1' }], finalAnswer: 'Choice A', citations: [], groundedInKb: true }) };
  const hints = { hint: vi.fn().mockResolvedValue({ level: 1, hint: 'nudge', nextLevelAvailable: true, citations: [] }) };
  const formulas = { assist: vi.fn().mockResolvedValue({ query: 'q', formulas: [{ id: 'f-1', name: 'F', expression: 'a=b' }], guidance: 'use it' }) };
  const grounding = { validate: vi.fn().mockReturnValue({ ok: true, reasons: [] }) };
  const provider = { name: 'det', respond: vi.fn().mockResolvedValue({ content: 'free answer', followUps: ['fu'], tokensIn: 5, tokensOut: 10 }), solve: vi.fn() };
  const events = { emit: vi.fn() };
  const prisma = { question: { findFirst: vi.fn().mockResolvedValue(null) } };
  const diagrams = { resolveMany: vi.fn().mockResolvedValue(new Map()), resolveOne: vi.fn().mockResolvedValue(null), publicIdFor: vi.fn() };
  const featureAccess = { enforceAiTutorQuota: vi.fn().mockResolvedValue(undefined) };
  const svc = new AITutorService(conversations as never, context as never, explanation as never, solution as never, hints as never, formulas as never, grounding as never, provider as never, events as never, prisma as never, diagrams as never, featureAccess as never);
  return { conversations, context, explanation, solution, hints, formulas, grounding, provider, events, prisma, diagrams, featureAccess, svc };
}

describe('AITutorService (chat hub)', () => {
  let m: ReturnType<typeof mocks>;
  beforeEach(() => { m = mocks(); });

  describe('startConversation', () => {
    it('creates a conversation without a first message', async () => {
      const r = await m.svc.startConversation('u-1', { title: 'Help' });
      expect(r.conversation.id).toBe('c-1');
      expect(r.firstAnswer).toBeNull();
    });
    it('answers the first message immediately when provided', async () => {
      const r = await m.svc.startConversation('u-1', { firstMessage: 'What is equilibrium?' });
      expect(r.firstAnswer).not.toBeNull();
      expect(m.conversations.appendUserMessage).toHaveBeenCalled();
    });
  });

  describe('sendMessage routing', () => {
    it('routes explain_question to the explanation service', async () => {
      await m.svc.sendMessage('u-1', 'c-1', { message: 'explain', intent: 'explain_question', questionId: 'q-1' } as never);
      expect(m.explanation.explainQuestion).toHaveBeenCalledWith('q-1');
    });
    it('routes step_solution to the solution service and renders steps', async () => {
      const r = await m.svc.sendMessage('u-1', 'c-1', { message: 'solve', intent: 'step_solution', questionId: 'q-1' } as never);
      expect(m.solution.solve).toHaveBeenCalled();
      expect(r.content).toContain('Final answer');
    });
    it('routes hint to the hint service', async () => {
      await m.svc.sendMessage('u-1', 'c-1', { message: 'hint please', intent: 'hint', questionId: 'q-1' } as never);
      expect(m.hints.hint).toHaveBeenCalled();
    });
    it('routes formula_help to the formula assistant', async () => {
      await m.svc.sendMessage('u-1', 'c-1', { message: 'ohms law', intent: 'formula_help' } as never);
      expect(m.formulas.assist).toHaveBeenCalled();
    });
    it('routes explain_concept to the explanation service', async () => {
      await m.svc.sendMessage('u-1', 'c-1', { message: 'what is X', intent: 'explain_concept' } as never);
      expect(m.explanation.explainConcept).toHaveBeenCalled();
    });
    it('falls back to the provider for free-form questions', async () => {
      await m.svc.sendMessage('u-1', 'c-1', { message: 'general question', intent: 'ask_question' } as never);
      expect(m.provider.respond).toHaveBeenCalled();
    });
    it('prepends the linked diagram as a markdown image when the question has one', async () => {
      m.prisma.question.findFirst.mockResolvedValue({ questionCode: 'Q-STR-1' });
      m.diagrams.resolveOne.mockResolvedValue({ publicId: 'FIG.Q.STR.1', title: 'Frame', imageUrl: 'data:image/svg+xml;base64,AAAA', altText: 'Frame diagram', caption: null, description: null });
      const r = await m.svc.sendMessage('u-1', 'c-1', { message: 'explain', intent: 'explain_question', questionId: 'q-1' } as never);
      expect(m.diagrams.resolveOne).toHaveBeenCalledWith('Q-STR-1');
      expect(r.content).toContain('![Frame diagram](data:image/svg+xml;base64,AAAA)');
    });
    it('does not touch content when the question has no linked diagram', async () => {
      m.prisma.question.findFirst.mockResolvedValue({ questionCode: 'Q-STR-2' });
      const r = await m.svc.sendMessage('u-1', 'c-1', { message: 'explain', intent: 'explain_question', questionId: 'q-1' } as never);
      expect(r.content).toBe('expl');
    });
  });

  describe('classification (no explicit intent)', () => {
    it('classifies a hint request on a question', async () => {
      await m.svc.sendMessage('u-1', 'c-1', { message: 'can I get a hint?', questionId: 'q-1' } as never);
      expect(m.hints.hint).toHaveBeenCalled();
    });
    it('classifies a formula question', async () => {
      await m.svc.sendMessage('u-1', 'c-1', { message: 'what formula do I use' } as never);
      expect(m.formulas.assist).toHaveBeenCalled();
    });
  });

  describe('misconception detection + grounding', () => {
    it('appends a misconception warning when the message brushes one', async () => {
      const r = await m.svc.sendMessage('u-1', 'c-1', { message: 'I think the sign error is fine', intent: 'ask_question' } as never);
      expect(r.content).toMatch(/misconception/i);
      expect(m.events.emit).toHaveBeenCalledWith(expect.stringContaining('misconception.detected'), expect.any(Object));
    });
    it('persists the assistant turn with validation result', async () => {
      await m.svc.sendMessage('u-1', 'c-1', { message: 'hi', intent: 'ask_question' } as never);
      expect(m.conversations.appendAssistantMessage).toHaveBeenCalledWith('u-1', 'c-1', expect.objectContaining({ validatedOk: true }));
    });
  });

  describe('archived guard', () => {
    it('rejects sending to an archived conversation', async () => {
      m.conversations.getOwned.mockResolvedValue({ id: 'c-1', userId: 'u-1', status: 'archived' });
      await expect(m.svc.sendMessage('u-1', 'c-1', { message: 'hi' } as never)).rejects.toThrow(BadRequestException);
    });
  });
});
