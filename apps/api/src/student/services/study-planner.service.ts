/**
 * @file study-planner.service.ts
 * @module Student/Services
 *
 * StudyPlannerService — study plans (calendar), daily/weekly/monthly tasks, and
 * study goals. All ownership-scoped. Goals are upserted per period; plan tasks
 * are queryable by date for the calendar view.
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StudentErrors } from '../errors/student.errors';
import type { CreatePlanDto, CreateTaskDto, UpdateTaskStatusDto, UpsertGoalDto } from '../dto/student.dto';

@Injectable()
export class StudyPlannerService {

  constructor(private readonly prisma: PrismaService) {}

  // ── Goals ───────────────────────────────────────────────────────────────────
  async upsertGoal(userId: string, dto: UpsertGoalDto) {
    return this.prisma.studyGoal.upsert({
      where: { userId_period: { userId, period: dto.period as never } },
      create: { userId, period: dto.period as never, targetQuestions: dto.targetQuestions, targetMinutes: dto.targetMinutes ?? null, isActive: true },
      update: { targetQuestions: dto.targetQuestions, targetMinutes: dto.targetMinutes ?? null, isActive: true },
    });
  }

  async listGoals(userId: string) {
    return this.prisma.studyGoal.findMany({ where: { userId, isActive: true }, orderBy: { period: 'asc' } });
  }

  // ── Plans ───────────────────────────────────────────────────────────────────
  async createPlan(userId: string, dto: CreatePlanDto) {
    return this.prisma.studyPlan.create({
      data: { userId, title: dto.title, description: dto.description ?? null, startDate: new Date(dto.startDate), endDate: new Date(dto.endDate) },
    });
  }

  async listPlans(userId: string) {
    return this.prisma.studyPlan.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, include: { _count: { select: { tasks: true } } } });
  }

  async getPlan(userId: string, planId: string) {
    const plan = await this.prisma.studyPlan.findUnique({ where: { id: planId }, include: { tasks: { orderBy: { scheduledDate: 'asc' } } } });
    if (!plan) throw StudentErrors.planNotFound(planId);
    if (plan.userId !== userId) throw StudentErrors.planForbidden();
    return plan;
  }

  async deletePlan(userId: string, planId: string) {
    await this.getPlan(userId, planId); // ownership check
    await this.prisma.studyPlan.delete({ where: { id: planId } });
    return { deleted: true };
  }

  // ── Tasks ───────────────────────────────────────────────────────────────────
  async addTask(userId: string, planId: string, dto: CreateTaskDto) {
    await this.getPlan(userId, planId); // ownership check
    return this.prisma.studyPlanTask.create({
      data: { planId, userId, title: dto.title, scheduledDate: new Date(dto.scheduledDate), subjectId: dto.subjectId ?? null, topicId: dto.topicId ?? null, targetQuestions: dto.targetQuestions },
    });
  }

  async updateTaskStatus(userId: string, taskId: string, dto: UpdateTaskStatusDto) {
    const task = await this.prisma.studyPlanTask.findUnique({ where: { id: taskId } });
    if (!task) throw StudentErrors.taskNotFound(taskId);
    if (task.userId !== userId) throw StudentErrors.ownershipViolation();
    return this.prisma.studyPlanTask.update({
      where: { id: taskId },
      data: { status: dto.status as never, ...(dto.status === 'completed' && { completedAt: new Date() }) },
    });
  }

  /** Calendar view: tasks within a date range for the user. */
  async calendar(userId: string, from: string, to: string) {
    const tasks = await this.prisma.studyPlanTask.findMany({
      where: { userId, scheduledDate: { gte: new Date(from), lte: new Date(to) } },
      orderBy: { scheduledDate: 'asc' },
    });
    return tasks.map((t: { id: string; planId: string; title: string; scheduledDate: Date; status: string; targetQuestions: number; subjectId: string | null; topicId: string | null }) => ({
      id: t.id, planId: t.planId, title: t.title, scheduledDate: t.scheduledDate.toISOString().slice(0, 10), status: t.status, targetQuestions: t.targetQuestions, subjectId: t.subjectId, topicId: t.topicId,
    }));
  }
}
