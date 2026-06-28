/**
 * @file reference-books.service.ts — admin CRUD for Reference Books (the library
 * questions cite). Hard delete, blocked (P2003 → 409) when still referenced.
 */
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { CreateReferenceBookDto, UpdateReferenceBookDto, ListQueryDto } from '../dto/taxonomy.dto';

@Injectable()
export class ReferenceBooksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q?: ListQueryDto) {
    const where: Prisma.ReferenceBookWhereInput = {};
    if (q?.q) where.OR = [
      { title: { contains: q.q, mode: 'insensitive' } },
      { publisher: { contains: q.q, mode: 'insensitive' } },
      { subjectArea: { contains: q.q, mode: 'insensitive' } },
    ];
    if (typeof q?.isActive === 'boolean') where.isActive = q.isActive;
    const page = q?.page ?? 1;
    const limit = q?.limit ?? 20;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.referenceBook.findMany({
        where,
        orderBy: [{ title: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { questionReferences: true } } },
      }),
      this.prisma.referenceBook.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async findById(id: string) {
    const row = await this.prisma.referenceBook.findUnique({ where: { id }, include: { _count: { select: { questionReferences: true } } } });
    if (!row) throw new NotFoundException('Reference book not found.');
    return row;
  }

  async create(dto: CreateReferenceBookDto) {
    try {
      return await this.prisma.referenceBook.create({ data: dto });
    } catch (e) { throw this.mapError(e); }
  }

  async update(id: string, dto: UpdateReferenceBookDto) {
    await this.findById(id);
    try {
      return await this.prisma.referenceBook.update({ where: { id }, data: dto });
    } catch (e) { throw this.mapError(e); }
  }

  async remove(id: string) {
    await this.findById(id);
    try {
      await this.prisma.referenceBook.delete({ where: { id } });
      return { id, deleted: true };
    } catch (e) { throw this.mapError(e); }
  }

  async bulkRemove(ids: string[]) {
    try {
      const res = await this.prisma.referenceBook.deleteMany({ where: { id: { in: ids } } });
      return { deleted: res.count };
    } catch (e) { throw this.mapError(e); }
  }

  private mapError(e: unknown): Error {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2002') return new ConflictException('A reference book with that title or ISBN already exists.');
      if (e.code === 'P2003') return new ConflictException('Cannot delete: this reference book is still cited by questions.');
    }
    return e as Error;
  }
}
