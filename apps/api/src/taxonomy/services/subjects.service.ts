/**
 * @file subjects.service.ts — admin CRUD for Subjects (taxonomy level 1).
 * Soft-delete via deletedAt; count() needs an explicit deletedAt filter because
 * the PrismaService soft-delete extension only covers find* (not count).
 */
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { CreateSubjectDto, UpdateSubjectDto, ListQueryDto } from '../dto/taxonomy.dto';

@Injectable()
export class SubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: ListQueryDto) {
    const where: Prisma.SubjectWhereInput = { deletedAt: null };
    if (q.q) {
      where.OR = [
        { name: { contains: q.q, mode: 'insensitive' } },
        { code: { contains: q.q, mode: 'insensitive' } },
      ];
    }
    if (typeof q.isActive === 'boolean') where.isActive = q.isActive;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.subject.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { _count: { select: { topics: true, questions: true } } },
      }),
      this.prisma.subject.count({ where }),
    ]);
    return { items, total, page: q.page, limit: q.limit };
  }

  async findById(id: string) {
    const subject = await this.prisma.subject.findFirst({
      where: { id },
      include: { _count: { select: { topics: true, questions: true } } },
    });
    if (!subject) throw new NotFoundException('Subject not found.');
    return subject;
  }

  async create(dto: CreateSubjectDto) {
    try {
      return await this.prisma.subject.create({ data: dto });
    } catch (e) {
      throw this.mapError(e);
    }
  }

  async update(id: string, dto: UpdateSubjectDto) {
    await this.findById(id);
    try {
      return await this.prisma.subject.update({ where: { id }, data: dto });
    } catch (e) {
      throw this.mapError(e);
    }
  }

  async remove(id: string) {
    await this.findById(id);
    await this.prisma.subject.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    return { id, deleted: true };
  }

  async bulkRemove(ids: string[]) {
    const res = await this.prisma.subject.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { deletedAt: new Date(), isActive: false },
    });
    return { deleted: res.count };
  }

  private mapError(e: unknown): Error {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2002') return new ConflictException('A subject with that name or code already exists.');
      if (e.code === 'P2003') return new BadRequestException('Invalid reference.');
    }
    return e as Error;
  }
}
