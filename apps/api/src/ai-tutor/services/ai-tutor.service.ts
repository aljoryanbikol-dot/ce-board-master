/**
 * @file ai-tutor.service.ts
 * @module AITutor/Services
 *
 * AITutorService — the chat orchestrator. It is the hub that turns a user
 * message into a grounded assistant turn: classify intent, assemble KB context
 * (with session memory), route to the right capability (explanation / hint /
 * solution / formula / coaching / free-form), detect misconceptions, validate
 * grounding, persist both messages with citations, and return the answer with
 * follow-ups. It holds orchestration only — every capability lives in its own
 * service or the provider (zero duplicated business logic).
 */
import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConversationService } from './conversation.service';
import { TutorContextService } from './tutor-context.service';
import { ExplanationService } from './explanation.service';
import { SolutionService } from './solution.service';
import { HintService } from './hint.service';
import { FormulaAssistantService } from './formula-assistant.service';
import { GroundingValidationService } from './grounding-validation.service';
import { PrismaService } from '../../database/prisma.service';
import { QuestionDiagramLookupService } from '../../questions/services/question-diagram-lookup.service';
import { TUTOR_PROVIDER, type TutorProvider } from '../providers/tutor-provider.interface';
import { TutorErrors } from '../errors/tutor.errors';
import { EVENTS } from '../../common/constants';
import type { Citation, TutorAnswer } from '../types/tutor.types';
import type { SendMessageDto } from '../dto/tutor.dto';

@Injectable()
export class AITutorService {
  constructor(
    private readonly conversations: ConversationService,
    private readonly context: TutorContextService,
    private readonly explanation: ExplanationService,
    private readonly solution: SolutionService,
    private readonly hints: HintService,
    private readonly formulas: FormulaAssistantService,
    private readonly grounding: GroundingValidationService,
    @Inject(TUTOR_PROVIDER) private readonly provider: TutorProvider,
    private readonly eventEmitter: EventEmitter2,
    private readonly prisma: PrismaService,
    private readonly diagrams: QuestionDiagramLookupService,
  ) {}

  /** Start a conversation, optionally with a first message answered immediately. */
  async startConversation(userId: string, params: { title?: string; subjectId?: string; topicId?: string; firstMessage?: string }) {
    const convo = await this.conversations.create(userId, params);
    if (params.firstMessage) {
      const answer = await this.sendMessage(userId, convo.id, { message: params.firstMessage });
      return { conversation: convo, firstAnswer: answer };
    }
    return { conversation: convo, firstAnswer: null };
  }

  /** The chat hub: handle one user message within a conversation. */
  async sendMessage(userId: string, conversationId: string, dto: SendMessageDto): Promise<TutorAnswer> {
    const convo = await this.conversations.getOwned(userId, conversationId);
    if (convo.status === 'archived') throw TutorErrors.conversationArchived();

    const intent = dto.intent ?? this.classify(dto.message, dto.questionId);

    // Persist the user's message first.
    await this.conversations.appendUserMessage(userId, conversationId, dto.message, intent, dto.questionId);

    // Assemble context with session memory + recent turns.
    const recentTurns = await this.conversations.recentTurns(conversationId);
    const ctx = await this.context.build({
      subjectId: convo.subjectId, topicId: convo.topicId, queryText: dto.message,
      memorySummary: convo.memorySummary, recentTurns,
    });

    // Route by intent (delegating to specialist services where applicable).
    let content: string;
    let citations: Citation[];
    let followUps: string[];
    let groundedInKb: boolean;
    const providerName = this.provider.name;

    if (intent === 'explain_question' && dto.questionId) {
      const r = await this.explanation.explainQuestion(dto.questionId);
      content = r.content; citations = r.citations; followUps = r.followUps; groundedInKb = r.groundedInKb;
    } else if (intent === 'step_solution' && dto.questionId) {
      const r = await this.solution.solve(userId, dto.questionId);
      content = this.renderSteps(r.steps, r.finalAnswer); citations = r.citations; followUps = ['Can you explain why this step works?']; groundedInKb = r.groundedInKb;
    } else if (intent === 'hint' && dto.questionId) {
      const r = await this.hints.hint(userId, dto.questionId);
      content = r.hint; citations = r.citations; followUps = ['Give me a stronger hint', 'Show the full solution']; groundedInKb = r.citations.length > 0;
    } else if (intent === 'formula_help') {
      const r = await this.formulas.assist(dto.message, { subjectId: convo.subjectId ?? undefined, topicId: convo.topicId ?? undefined });
      content = r.guidance; citations = r.formulas.map((f) => ({ kind: 'formula' as const, refId: f.id, label: f.name, snippet: f.expression })); followUps = ['How is this formula derived?']; groundedInKb = r.formulas.length > 0;
    } else if (intent === 'explain_concept') {
      const r = await this.explanation.explainConcept(dto.message, { subjectId: convo.subjectId ?? undefined, topicId: convo.topicId ?? undefined });
      content = r.content; citations = r.citations; followUps = r.followUps; groundedInKb = r.groundedInKb;
    } else {
      // Free-form / followup / coaching → provider with assembled context.
      const out = await this.provider.respond({ intent, prompt: dto.message, context: ctx });
      content = out.content; followUps = out.followUps; citations = this.context.citationsFromContext(ctx); groundedInKb = citations.length > 0;
    }

    // If this turn discusses a specific question that has a linked diagram, show it —
    // MarkdownMath (the chat renderer) already supports inline `![alt](url)` images.
    if (dto.questionId && ['explain_question', 'step_solution', 'hint'].includes(intent)) {
      const diagramMd = await this.diagramMarkdownFor(dto.questionId);
      if (diagramMd) content = `${diagramMd}\n\n${content}`;
    }

    // Misconception detection: if the question/message brushes a known misconception, surface it.
    const misconception = this.detectMisconception(dto.message, ctx);
    if (misconception) {
      citations.push({ kind: 'misconception', refId: misconception.publicId, label: misconception.title, snippet: misconception.description.slice(0, 280) });
      content += `\n\n⚠️ Common misconception — ${misconception.title}: ${misconception.description}`;
      this.eventEmitter.emit(EVENTS.TUTOR_MISCONCEPTION_DETECTED, { userId, conversationId, refId: misconception.publicId });
    }

    // Grounding validation.
    const validatedOk = this.grounding.validate(content, ctx).ok;
    this.eventEmitter.emit(EVENTS.TUTOR_RESPONSE_VALIDATED, { userId, conversationId, validatedOk });

    // Persist the assistant turn + citations.
    await this.conversations.appendAssistantMessage(userId, conversationId, {
      content, intent, citations, groundedInKb, validatedOk, providerName, tokensIn: this.estimate(dto.message), tokensOut: this.estimate(content), questionId: dto.questionId,
    });

    return { content, intent, citations, groundedInKb, validatedOk, followUps, providerName, tokensIn: this.estimate(dto.message), tokensOut: this.estimate(content) };
  }

  // ── helpers ───────────────────────────────────────────────────────────────────

  /** Lightweight intent classifier (keyword heuristic; AI-ready behind sendMessage). */
  private classify(message: string, questionId?: string): string {
    const m = message.toLowerCase();
    if (questionId && /hint/.test(m)) return 'hint';
    if (questionId && /(step|solve|solution|work.*out)/.test(m)) return 'step_solution';
    if (questionId) return 'explain_question';
    if (/formula|equation/.test(m)) return 'formula_help';
    if (/(explain|what is|define|concept|how does)/.test(m)) return 'explain_concept';
    if (/(coach|weak|improve|study plan)/.test(m)) return 'coaching';
    return 'ask_question';
  }

  private detectMisconception(message: string, ctx: { misconceptions: { publicId: string; title: string; description: string }[] }) {
    const lower = message.toLowerCase();
    return ctx.misconceptions.find((m) => {
      const key = m.title.toLowerCase().split(/\W+/).filter((w) => w.length > 4);
      return key.some((w) => lower.includes(w));
    }) ?? null;
  }

  private async diagramMarkdownFor(questionId: string): Promise<string | null> {
    const q = await this.prisma.question.findFirst({ where: { id: questionId, deletedAt: null }, select: { questionCode: true } });
    if (!q) return null;
    const diagram = await this.diagrams.resolveOne(q.questionCode);
    return diagram ? `![${diagram.altText}](${diagram.imageUrl})` : null;
  }

  private renderSteps(steps: { order: number; text: string }[], finalAnswer: string): string {
    return `${steps.map((s) => `${s.order}. ${s.text}`).join('\n')}\n\nFinal answer: ${finalAnswer}`;
  }

  private estimate(text: string): number {
    return Math.ceil((text?.length ?? 0) / 4);
  }
}
