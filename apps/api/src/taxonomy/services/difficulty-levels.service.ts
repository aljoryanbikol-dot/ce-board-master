/**
 * @file difficulty-levels.service.ts — read access to difficulty levels (for the
 * question editor dropdown). Full CRUD lands in the Difficulty Levels slice.
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DifficultyLevelsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const items = await this.prisma.difficultyLevel.findMany({
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      include: { _count: { select: { questions: true } } },
    });
    return { items, total: items.length, page: 1, limit: items.length };
  }
}
