import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { StudyPlannerService } from '../services/study-planner.service';

function mocks() {
  const prisma = {
    studyGoal: { upsert: vi.fn().mockResolvedValue({ id: 'g-1' }), findMany: vi.fn().mockResolvedValue([]) },
    studyPlan: { create: vi.fn().mockResolvedValue({ id: 'p-1' }), findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn(), delete: vi.fn().mockResolvedValue({}) },
    studyPlanTask: { create: vi.fn().mockResolvedValue({ id: 't-1' }), findUnique: vi.fn(), update: vi.fn().mockResolvedValue({ id: 't-1', status: 'completed' }), findMany: vi.fn().mockResolvedValue([]) },
  };
  return { prisma, svc: new StudyPlannerService(prisma as never) };
}

describe('StudyPlannerService', () => {
  let m: ReturnType<typeof mocks>;
  beforeEach(() => { m = mocks(); });

  it('upserts a study goal per period', async () => {
    await m.svc.upsertGoal('u-1', { period: 'daily', targetQuestions: 20 } as never);
    expect(m.prisma.studyGoal.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { userId_period: { userId: 'u-1', period: 'daily' } } }));
  });

  it('creates a study plan', async () => {
    const plan = await m.svc.createPlan('u-1', { title: 'Board Prep', startDate: '2026-07-01', endDate: '2026-09-30' } as never);
    expect(plan.id).toBe('p-1');
  });

  describe('getPlan ownership', () => {
    it('returns a plan owned by the user', async () => {
      m.prisma.studyPlan.findUnique.mockResolvedValue({ id: 'p-1', userId: 'u-1', tasks: [] });
      const plan = await m.svc.getPlan('u-1', 'p-1');
      expect(plan.id).toBe('p-1');
    });
    it('throws for a non-owned plan', async () => {
      m.prisma.studyPlan.findUnique.mockResolvedValue({ id: 'p-1', userId: 'other', tasks: [] });
      await expect(m.svc.getPlan('u-1', 'p-1')).rejects.toThrow(ForbiddenException);
    });
    it('throws for a missing plan', async () => {
      m.prisma.studyPlan.findUnique.mockResolvedValue(null);
      await expect(m.svc.getPlan('u-1', 'p-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('addTask', () => {
    it('adds a task to an owned plan', async () => {
      m.prisma.studyPlan.findUnique.mockResolvedValue({ id: 'p-1', userId: 'u-1', tasks: [] });
      const task = await m.svc.addTask('u-1', 'p-1', { title: 'Practice statics', scheduledDate: '2026-07-05', targetQuestions: 10 } as never);
      expect(task.id).toBe('t-1');
    });
  });

  describe('updateTaskStatus', () => {
    it('updates an owned task and sets completedAt on completion', async () => {
      m.prisma.studyPlanTask.findUnique.mockResolvedValue({ id: 't-1', userId: 'u-1' });
      await m.svc.updateTaskStatus('u-1', 't-1', { status: 'completed' } as never);
      expect(m.prisma.studyPlanTask.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'completed' }) }));
    });
    it('rejects updating a non-owned task', async () => {
      m.prisma.studyPlanTask.findUnique.mockResolvedValue({ id: 't-1', userId: 'other' });
      await expect(m.svc.updateTaskStatus('u-1', 't-1', { status: 'completed' } as never)).rejects.toThrow(ForbiddenException);
    });
  });

  it('returns a calendar of tasks in range', async () => {
    m.prisma.studyPlanTask.findMany.mockResolvedValue([{ id: 't-1', planId: 'p-1', title: 'X', scheduledDate: new Date('2026-07-05'), status: 'pending', targetQuestions: 10, subjectId: null, topicId: null }]);
    const cal = await m.svc.calendar('u-1', '2026-07-01', '2026-07-31');
    expect(cal).toHaveLength(1);
    expect(cal[0]!.scheduledDate).toBe('2026-07-05');
  });
});
