/**
 * @file conversation.service.spec.ts
 * @module AITutor/Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConversationService } from '../services/conversation.service';

function mocks() {
  const tx = {
    tutorMessage: { create: vi.fn().mockResolvedValue({ id: 'msg-1', citations: [] }) },
    tutorConversation: { update: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    tutorConversation: {
      create: vi.fn().mockResolvedValue({ id: 'c-1', title: 'New tutoring session', status: 'active', subjectId: null, topicId: null, messageCount: 0, lastMessageAt: null, createdAt: new Date() }),
      findUnique: vi.fn(), findMany: vi.fn().mockResolvedValue([]), update: vi.fn().mockResolvedValue({}),
    },
    tutorMessage: { create: vi.fn().mockResolvedValue({ id: 'msg-1' }), findMany: vi.fn().mockResolvedValue([]) },
  };
  const cache = { del: vi.fn() };
  const events = { emit: vi.fn() };
  return { prisma, cache, events, tx, svc: new ConversationService(prisma as never, cache as never, events as never) };
}

describe('ConversationService', () => {
  let m: ReturnType<typeof mocks>;
  beforeEach(() => { m = mocks(); });

  describe('create', () => {
    it('creates a conversation and emits started', async () => {
      const view = await m.svc.create('u-1', { title: 'Statics help' });
      expect(view.id).toBe('c-1');
      expect(m.events.emit).toHaveBeenCalledWith(expect.stringContaining('conversation.started'), expect.any(Object));
    });
  });

  describe('getOwned', () => {
    it('returns an owned conversation', async () => {
      m.prisma.tutorConversation.findUnique.mockResolvedValue({ id: 'c-1', userId: 'u-1', status: 'active' });
      const convo = await m.svc.getOwned('u-1', 'c-1');
      expect(convo.id).toBe('c-1');
    });
    it('throws for a non-owner', async () => {
      m.prisma.tutorConversation.findUnique.mockResolvedValue({ id: 'c-1', userId: 'other', status: 'active' });
      await expect(m.svc.getOwned('u-1', 'c-1')).rejects.toThrow(ForbiddenException);
    });
    it('throws for a missing conversation', async () => {
      m.prisma.tutorConversation.findUnique.mockResolvedValue(null);
      await expect(m.svc.getOwned('u-1', 'c-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('appendUserMessage', () => {
    it('persists a user message and emits sent', async () => {
      await m.svc.appendUserMessage('u-1', 'c-1', 'hello', 'ask_question');
      expect(m.prisma.tutorMessage.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ role: 'user' }) }));
      expect(m.events.emit).toHaveBeenCalledWith(expect.stringContaining('message.sent'), expect.any(Object));
    });
  });

  describe('appendAssistantMessage', () => {
    it('persists the assistant message + citations and bumps message count by 2', async () => {
      m.prisma.tutorConversation.findUnique.mockResolvedValue({ messageCount: 2, memorySummary: null });
      await m.svc.appendAssistantMessage('u-1', 'c-1', {
        content: 'answer', intent: 'ask_question', citations: [{ kind: 'formula', refId: 'f-1', label: 'F' }],
        groundedInKb: true, validatedOk: true, providerName: 'det', tokensIn: 5, tokensOut: 10,
      });
      expect(m.tx.tutorMessage.create).toHaveBeenCalled();
      expect(m.tx.tutorConversation.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ messageCount: { increment: 2 } }) }));
      expect(m.events.emit).toHaveBeenCalledWith(expect.stringContaining('response.generated'), expect.any(Object));
    });
    it('summarizes memory once the thread is long enough', async () => {
      m.prisma.tutorConversation.findUnique.mockResolvedValue({ messageCount: 20, memorySummary: null });
      m.prisma.tutorMessage.findMany.mockResolvedValue([{ role: 'user', content: 'first', intent: 'ask_question' }]);
      await m.svc.appendAssistantMessage('u-1', 'c-1', { content: 'a', intent: 'ask_question', citations: [], groundedInKb: false, validatedOk: true, providerName: 'det', tokensIn: 1, tokensOut: 1 });
      expect(m.prisma.tutorConversation.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ memorySummary: expect.any(String) }) }));
    });
  });

  describe('archive', () => {
    it('archives an owned conversation', async () => {
      m.prisma.tutorConversation.findUnique.mockResolvedValue({ id: 'c-1', userId: 'u-1', status: 'active' });
      const r = await m.svc.archive('u-1', 'c-1');
      expect(r.archived).toBe(true);
      expect(m.events.emit).toHaveBeenCalledWith(expect.stringContaining('archived'), expect.any(Object));
    });
  });

  describe('recentTurns', () => {
    it('returns turns oldest→newest within the window', async () => {
      m.prisma.tutorMessage.findMany.mockResolvedValue([{ role: 'assistant', content: 'b' }, { role: 'user', content: 'a' }]);
      const turns = await m.svc.recentTurns('c-1');
      expect(turns[0]!.content).toBe('a'); // reversed to chronological
    });
  });

  describe('getMessages', () => {
    it('enforces ownership before returning messages', async () => {
      m.prisma.tutorConversation.findUnique.mockResolvedValue({ id: 'c-1', userId: 'other', status: 'active' });
      await expect(m.svc.getMessages('u-1', 'c-1', 20)).rejects.toThrow(ForbiddenException);
    });
  });
});
