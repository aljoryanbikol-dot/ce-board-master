/**
 * @file topics.service.ts — admin CRUD for Topics (Categories, taxonomy level 2).
 */
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { CreateTopicDto, UpdateTopicDto, ListQueryDto } from '../dto/taxonomy.dto';

@Injectable()
export class TopicsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: ListQueryDto) {
    const where: Prisma.TopicWhereInput = { deletedAt: null };
    if (q.subjectId) where.subjectId = q.subjectId;
    if (q.q) {
      where.OR = [
        { name: { contains: q.q, mode: 'insensitive' } },
        { code: { contains: q.q, mode: 'insensitive' } },
      ];
    }
    if (typeof q.isActive === 'boolean') where.isActive = q.isActive;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.topic.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: {
          subject: { select: { id: true, name: true, code: true } },
          _count: { select: { subtopics: true, questions: true } },
        },
      }),
      this.prisma.topic.count({ where }),
    ]);
    return { items, total, page: q.page, limit: q.limit };
  }

  async findById(id: string) {
    const topic = await this.prisma.topic.findFirst({
      where: { id },
      include: { subject: { select: { id: true, name: true, code: true } }, _count: { select: { subtopics: true, questions: true } } },
    });
    if (!topic) throw new NotFoundException('Topic not found.');
    return topic;
  }

  async create(dto: CreateTopicDto) {
    try {
      return await this.prisma.topic.create({ data: dto });
    } catch (e) {
      throw this.mapError(e);
    }
  }

  async update(id: string, dto: UpdateTopicDto) {
    await this.findById(id);
    try {
      return await this.prisma.topic.update({ where: { id }, data: dto });
    } catch (e) {
      throw this.mapError(e);
    }
  }

  async remove(id: string) {
    await this.findById(id);
    await this.prisma.topic.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    return { id, deleted: true };
  }

  async bulkRemove(ids: string[]) {
    const res = await this.prisma.topic.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { deletedAt: new Date(), isActive: false },
    });
    return { deleted: res.count };
  }

  private mapError(e: unknown): Error {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2002') return new ConflictException('A topic with that code already exists.');
      if (e.code === 'P2003') return new BadRequestException('The selected subject does not exist.');
    }
    return e as Error;
  }
}
