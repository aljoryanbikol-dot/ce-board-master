/**
 * @file controllers.spec.ts
 * @module AITutor/Tests
 *
 * Direct-instantiation controller tests (esbuild has no DI metadata). Verify each
 * endpoint delegates to its service with the current user's id for ownership.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AITutorController } from '../controllers/ai-tutor.controller';
import { ConversationController } from '../controllers/conversation.controller';
import { ExplanationController } from '../controllers/explanation.controller';
import { HintController } from '../controllers/hint.controller';
import { SolutionController } from '../controllers/solution.controller';
import { FormulaAssistantController } from '../controllers/formula-assistant.controller';
import { RecommendationController } from '../controllers/recommendation.controller';
import { CoachingController } from '../controllers/coaching.controller';
import type { AuthenticatedUser } from '../../auth/auth.types';

const user: AuthenticatedUser = { id: 'u-1', email: 's@ce.com', role: 'subscriber', subscriptionTier: 'pro' } as never;

describe('AI Tutor controllers (delegation + ownership)', () => {
  describe('AITutorController', () => {
    const tutor = { startConversation: vi.fn().mockResolvedValue({}), sendMessage: vi.fn().mockResolvedValue({}) };
    let c: AITutorController;
    beforeEach(() => { vi.clearAllMocks(); c = new AITutorController(tutor as never); });
    it('start passes user id + body', async () => { await c.start({ title: 'T' } as never, user); expect(tutor.startConversation).toHaveBeenCalledWith('u-1', { title: 'T' }); });
    it('send passes conversation id + body', async () => { await c.send('c-1', { message: 'hi' } as never, user); expect(tutor.sendMessage).toHaveBeenCalledWith('u-1', 'c-1', { message: 'hi' }); });
    it('ask creates a conversation with the question as first message', async () => { await c.ask({ question: 'What is X?' } as never, user); expect(tutor.startConversation).toHaveBeenCalledWith('u-1', expect.objectContaining({ firstMessage: 'What is X?' })); });
  });

  describe('ConversationController', () => {
    const conversations = { list: vi.fn().mockResolvedValue({}), getMessages: vi.fn().mockResolvedValue({}), archive: vi.fn().mockResolvedValue({}) };
    let c: ConversationController;
    beforeEach(() => { vi.clearAllMocks(); c = new ConversationController(conversations as never); });
    it('list delegates with user id', async () => { await c.list({ limit: 20 } as never, user); expect(conversations.list).toHaveBeenCalledWith('u-1', 20, undefined); });
    it('messages enforces ownership via user id', async () => { await c.messages('c-1', { limit: 20 } as never, user); expect(conversations.getMessages).toHaveBeenCalledWith('u-1', 'c-1', 20, undefined); });
    it('archive delegates', async () => { await c.archive('c-1', user); expect(conversations.archive).toHaveBeenCalledWith('u-1', 'c-1'); });
  });

  describe('ExplanationController', () => {
    const explanation = { explainConcept: vi.fn().mockResolvedValue({}), explainQuestion: vi.fn().mockResolvedValue({}) };
    let c: ExplanationController;
    beforeEach(() => { vi.clearAllMocks(); c = new ExplanationController(explanation as never); });
    it('concept delegates', async () => { await c.concept({ concept: 'X' } as never); expect(explanation.explainConcept).toHaveBeenCalledWith('X', { subjectId: undefined, topicId: undefined }); });
    it('question delegates', async () => { await c.question({ questionId: 'q-1' } as never); expect(explanation.explainQuestion).toHaveBeenCalledWith('q-1'); });
  });

  describe('HintController', () => {
    const hints = { hint: vi.fn().mockResolvedValue({}) };
    let c: HintController;
    beforeEach(() => { vi.clearAllMocks(); c = new HintController(hints as never); });
    it('hint passes user id + level', async () => { await c.hint({ questionId: 'q-1', level: 2 } as never, user); expect(hints.hint).toHaveBeenCalledWith('u-1', 'q-1', 2); });
  });

  describe('SolutionController', () => {
    const solution = { solve: vi.fn().mockResolvedValue({}) };
    let c: SolutionController;
    beforeEach(() => { vi.clearAllMocks(); c = new SolutionController(solution as never); });
    it('solve passes user id', async () => { await c.solve({ questionId: 'q-1' } as never, user); expect(solution.solve).toHaveBeenCalledWith('u-1', 'q-1'); });
  });

  describe('FormulaAssistantController', () => {
    const formulas = { assist: vi.fn().mockResolvedValue({}) };
    let c: FormulaAssistantController;
    beforeEach(() => { vi.clearAllMocks(); c = new FormulaAssistantController(formulas as never); });
    it('assist delegates with query', async () => { await c.assist({ query: 'ohm' } as never); expect(formulas.assist).toHaveBeenCalledWith('ohm', { subjectId: undefined, topicId: undefined }); });
  });

  describe('RecommendationController', () => {
    const recs = { smartRecommendations: vi.fn().mockResolvedValue({}) };
    let c: RecommendationController;
    beforeEach(() => { vi.clearAllMocks(); c = new RecommendationController(recs as never); });
    it('smart delegates with user id + limit', async () => { await c.smart({ limit: 10 } as never, user); expect(recs.smartRecommendations).toHaveBeenCalledWith('u-1', { limit: 10 }); });
  });

  describe('CoachingController', () => {
    const coach = { listCoaching: vi.fn().mockResolvedValue([]), generateCoaching: vi.fn().mockResolvedValue([]), coachFromExam: vi.fn().mockResolvedValue([]), markRead: vi.fn().mockResolvedValue({}), dismiss: vi.fn().mockResolvedValue({}) };
    let c: CoachingController;
    beforeEach(() => { vi.clearAllMocks(); c = new CoachingController(coach as never); });
    it('list delegates with user id', async () => { await c.list({ limit: 20 } as never, user); expect(coach.listCoaching).toHaveBeenCalledWith('u-1', { unreadOnly: undefined, limit: 20 }); });
    it('generate delegates', async () => { await c.generate(user); expect(coach.generateCoaching).toHaveBeenCalledWith('u-1'); });
    it('fromExam passes exam id', async () => { await c.fromExam('ex-1', user); expect(coach.coachFromExam).toHaveBeenCalledWith('u-1', 'ex-1'); });
    it('markRead + dismiss enforce ownership via user id', async () => { await c.markRead('n-1', user); await c.dismiss('n-1', user); expect(coach.markRead).toHaveBeenCalledWith('u-1', 'n-1'); expect(coach.dismiss).toHaveBeenCalledWith('u-1', 'n-1'); });
  });
});
