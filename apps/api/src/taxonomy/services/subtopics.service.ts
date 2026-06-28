/**
 * @file subtopics.service.ts — admin CRUD for Subtopics (taxonomy level 3).
 */
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { CreateSubtopicDto, UpdateSubtopicDto, ListQueryDto } from '../dto/taxonomy.dto';

@Injectable()
export class SubtopicsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: ListQueryDto) {
    const where: Prisma.SubtopicWhereInput = { deletedAt: null };
    if (q.topicId) where.topicId = q.topicId;
    if (q.subjectId) where.topic = { subjectId: q.subjectId };
    if (q.q) {
      where.OR = [
        { name: { contains: q.q, mode: 'insensitive' } },
        { code: { contains: q.q, mode: 'insensitive' } },
      ];
    }
    if (typeof q.isActive === 'boolean') where.isActive = q.isActive;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.subtopic.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: {
          topic: { select: { id: true, name: true, code: true, subject: { select: { id: true, name: true } } } },
          _count: { select: { questions: true } },
        },
      }),
      this.prisma.subtopic.count({ where }),
    ]);
    return { items, total, page: q.page, limit: q.limit };
  }

  async findById(id: string) {
    const subtopic = await this.prisma.subtopic.findFirst({
      where: { id },
      include: { topic: { select: { id: true, name: true, code: true, subject: { select: { id: true, name: true } } } }, _count: { select: { questions: true } } },
    });
    if (!subtopic) throw new NotFoundException('Subtopic not found.');
    return subtopic;
  }

  async create(dto: CreateSubtopicDto) {
    try {
      return await this.prisma.subtopic.create({ data: dto });
    } catch (e) {
      throw this.mapError(e);
    }
  }

  async update(id: string, dto: UpdateSubtopicDto) {
    await this.findById(id);
    try {
      return await this.prisma.subtopic.update({ where: { id }, data: dto });
    } catch (e) {
      throw this.mapError(e);
    }
  }

  async remove(id: string) {
    await this.findById(id);
    await this.prisma.subtopic.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    return { id, deleted: true };
  }

  async bulkRemove(ids: string[]) {
    const res = await this.prisma.subtopic.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { deletedAt: new Date(), isActive: false },
    });
    return { deleted: res.count };
  }

  private mapError(e: unknown): Error {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2002') return new ConflictException('A subtopic with that code already exists.');
      if (e.code === 'P2003') return new BadRequestException('The selected topic does not exist.');
    }
    return e as Error;
  }
}
