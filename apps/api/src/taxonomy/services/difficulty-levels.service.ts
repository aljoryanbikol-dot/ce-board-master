/**
 * @file difficulty-levels.service.ts — admin CRUD for Difficulty Levels.
 * No deletedAt column: delete is a hard delete, blocked (P2003 → 409) when the
 * level is still referenced by questions.
 */
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { CreateDifficultyLevelDto, UpdateDifficultyLevelDto, ListQueryDto } from '../dto/taxonomy.dto';

@Injectable()
export class DifficultyLevelsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q?: ListQueryDto) {
    const where: Prisma.DifficultyLevelWhereInput = {};
    if (q?.q) where.name = { contains: q.q, mode: 'insensitive' };
    if (typeof q?.isActive === 'boolean') where.isActive = q.isActive;
    const page = q?.page ?? 1;
    const limit = q?.limit ?? 100;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.difficultyLevel.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { questions: true } } },
      }),
      this.prisma.difficultyLevel.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async findById(id: string) {
    const row = await this.prisma.difficultyLevel.findUnique({
      where: { id },
      include: { _count: { select: { questions: true } } },
    });
    if (!row) throw new NotFoundException('Difficulty level not found.');
    return row;
  }

  async create(dto: CreateDifficultyLevelDto) {
    try {
      return await this.prisma.difficultyLevel.create({ data: dto });
    } catch (e) { throw this.mapError(e); }
  }

  async update(id: string, dto: UpdateDifficultyLevelDto) {
    await this.findById(id);
    try {
      return await this.prisma.difficultyLevel.update({ where: { id }, data: dto });
    } catch (e) { throw this.mapError(e); }
  }

  async remove(id: string) {
    await this.findById(id);
    try {
      await this.prisma.difficultyLevel.delete({ where: { id } });
      return { id, deleted: true };
    } catch (e) { throw this.mapError(e); }
  }

  async bulkRemove(ids: string[]) {
    try {
      const res = await this.prisma.difficultyLevel.deleteMany({ where: { id: { in: ids } } });
      return { deleted: res.count };
    } catch (e) { throw this.mapError(e); }
  }

  private mapError(e: unknown): Error {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2002') return new ConflictException('A difficulty level with that name or code already exists.');
      if (e.code === 'P2003') return new ConflictException('Cannot delete: this difficulty level is still used by questions. Deactivate it instead.');
    }
    return e as Error;
  }
}
