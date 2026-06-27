/**
 * @file conversation.service.ts
 * @module AITutor/Services
 *
 * ConversationService — owns tutor conversations and their session memory. It
 * creates/lists/archives conversations (ownership-scoped), persists user and
 * assistant messages with citations, and maintains a rolling memory summary so
 * multi-turn threads stay coherent without unbounded context. It holds no
 * answer-generation logic — that lives in AITutorService and the provider.
 */
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { TutorErrors } from '../errors/tutor.errors';
import { EVENTS, CACHE_KEYS } from '../../common/constants';
import { TUTOR_LIMITS } from '../constants/tutor.constants';
import type { Citation, ConversationView } from '../types/tutor.types';

@Injectable()
export class ConversationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(userId: string, params: { title?: string; subjectId?: string; topicId?: string }): Promise<ConversationView> {
    const convo = await this.prisma.tutorConversation.create({
      data: {
        userId, title: params.title?.trim() || 'New tutoring session',
        subjectId: params.subjectId ?? null, topicId: params.topicId ?? null,
      },
    });
    this.eventEmitter.emit(EVENTS.TUTOR_CONVERSATION_STARTED, { userId, conversationId: convo.id });
    return this.toView(convo);
  }

  /** Ownership-checked fetch of a conversation (throws if not owner / archived-aware). */
  async getOwned(userId: string, conversationId: string) {
    const convo = await this.prisma.tutorConversation.findUnique({ where: { id: conversationId } });
    if (!convo) throw TutorErrors.conversationNotFound(conversationId);
    if (convo.userId !== userId) throw TutorErrors.conversationForbidden();
    return convo;
  }

  async list(userId: string, limit: number, cursor?: string) {
    const rows = await this.prisma.tutorConversation.findMany({
      where: { userId }, orderBy: { lastMessageAt: 'desc' }, take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return { data: page.map((c: any) => this.toView(c)), pagination: { cursor: hasMore ? page[page.length - 1]!.id : null, hasMore } };
  }

  async getMessages(userId: string, conversationId: string, limit: number, cursor?: string) {
    await this.getOwned(userId, conversationId);
    const rows = await this.prisma.tutorMessage.findMany({
      where: { conversationId }, orderBy: { createdAt: 'asc' }, take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      include: { citations: true },
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      data: page.map((msg: any) => ({
        id: msg.id, role: msg.role, intent: msg.intent, content: msg.content,
        groundedInKb: msg.groundedInKb, validatedOk: msg.validatedOk, providerName: msg.providerName,
        citations: msg.citations.map((c: any) => ({ kind: c.kind, refId: c.refId, label: c.label, snippet: c.snippet })),
        createdAt: msg.createdAt.toISOString(),
      })),
      pagination: { cursor: hasMore ? page[page.length - 1]!.id : null, hasMore },
    };
  }

  async archive(userId: string, conversationId: string) {
    await this.getOwned(userId, conversationId);
    await this.prisma.tutorConversation.update({ where: { id: conversationId }, data: { status: 'archived' } });
    this.eventEmitter.emit(EVENTS.TUTOR_CONVERSATION_ARCHIVED, { userId, conversationId });
    await this.cache.del(CACHE_KEYS.tutor.conversation(conversationId));
    return { archived: true };
  }

  /** Persist a user message. */
  async appendUserMessage(userId: string, conversationId: string, content: string, intent: string | null, questionId?: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma;
    const msg = await db.tutorMessage.create({
      data: { conversationId, userId, role: 'user', intent: intent as never, content, questionId: questionId ?? null },
    });
    this.eventEmitter.emit(EVENTS.TUTOR_MESSAGE_SENT, { userId, conversationId, messageId: msg.id });
    return msg;
  }

  /** Persist an assistant message + its citations, and update conversation memory. */
  async appendAssistantMessage(
    userId: string, conversationId: string,
    params: { content: string; intent: string; citations: Citation[]; groundedInKb: boolean; validatedOk: boolean; providerName: string; tokensIn: number; tokensOut: number; questionId?: string },
  ) {
    const msg = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const created = await tx.tutorMessage.create({
        data: {
          conversationId, userId, role: 'assistant', intent: params.intent as never, content: params.content,
          questionId: params.questionId ?? null, groundedInKb: params.groundedInKb, validatedOk: params.validatedOk,
          providerName: params.providerName, tokensIn: params.tokensIn, tokensOut: params.tokensOut,
          citations: { create: params.citations.map((c) => ({ kind: c.kind as never, refId: c.refId, label: c.label, snippet: c.snippet ?? null })) },
        },
        include: { citations: true },
      });
      // +2 messages this turn (user + assistant); update activity.
      await tx.tutorConversation.update({
        where: { id: conversationId },
        data: { messageCount: { increment: 2 }, lastMessageAt: new Date() },
      });
      return created;
    });

    if (params.citations.length) this.eventEmitter.emit(EVENTS.TUTOR_CITATION_ADDED, { conversationId, count: params.citations.length });
    this.eventEmitter.emit(EVENTS.TUTOR_RESPONSE_GENERATED, { userId, conversationId, messageId: msg.id, groundedInKb: params.groundedInKb });

    await this.maybeSummarize(conversationId);
    await this.cache.del(CACHE_KEYS.tutor.conversation(conversationId));
    return msg;
  }

  /** Recent turns for working memory (oldest→newest within the window). */
  async recentTurns(conversationId: string): Promise<{ role: string; content: string }[]> {
    const rows = await this.prisma.tutorMessage.findMany({
      where: { conversationId }, orderBy: { createdAt: 'desc' }, take: TUTOR_LIMITS.MEMORY_WINDOW_MESSAGES,
      select: { role: true, content: true },
    });
    return rows.reverse().map((r: { role: string; content: string }) => ({ role: r.role, content: r.content }));
  }

  /** Roll up older turns into the memory summary when a thread grows long. */
  private async maybeSummarize(conversationId: string) {
    const convo = await this.prisma.tutorConversation.findUnique({ where: { id: conversationId }, select: { messageCount: true, memorySummary: true } });
    if (!convo || convo.messageCount < TUTOR_LIMITS.MEMORY_SUMMARY_TRIGGER) return;

    // Deterministic summary: compress the earliest turns into a short recap.
    const early = await this.prisma.tutorMessage.findMany({
      where: { conversationId }, orderBy: { createdAt: 'asc' }, take: TUTOR_LIMITS.MEMORY_WINDOW_MESSAGES,
      select: { role: true, content: true, intent: true },
    });
    const topics = Array.from(new Set(early.map((m: { intent: string | null }) => m.intent).filter(Boolean)));
    const summary = `Earlier in this session the student covered: ${topics.join(', ') || 'general questions'}. Key user message: ${early.find((m: { role: string }) => m.role === 'user')?.content?.slice(0, 200) ?? ''}`;
    await this.prisma.tutorConversation.update({ where: { id: conversationId }, data: { memorySummary: summary } });
    await this.cache.del(CACHE_KEYS.tutor.memory(conversationId));
  }

  private toView(c: { id: string; title: string; status: string; subjectId: string | null; topicId: string | null; messageCount: number; lastMessageAt: Date | null; createdAt: Date }): ConversationView {
    return { id: c.id, title: c.title, status: c.status, subjectId: c.subjectId, topicId: c.topicId, messageCount: c.messageCount, lastMessageAt: c.lastMessageAt ? c.lastMessageAt.toISOString() : null, createdAt: c.createdAt.toISOString() };
  }
}
