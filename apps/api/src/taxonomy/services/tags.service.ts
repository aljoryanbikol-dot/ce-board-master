/**
 * @file tags.service.ts — admin CRUD for Tags. Slug auto-derived from name when
 * not supplied. Hard delete, blocked (P2003 → 409) when still applied to questions.
 */
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { CreateTagDto, UpdateTagDto, ListQueryDto } from '../dto/taxonomy.dto';

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q?: ListQueryDto) {
    const where: Prisma.TagWhereInput = {};
    if (q?.q) where.OR = [
      { name: { contains: q.q, mode: 'insensitive' } },
      { slug: { contains: q.q, mode: 'insensitive' } },
    ];
    if (typeof q?.isActive === 'boolean') where.isActive = q.isActive;
    const page = q?.page ?? 1;
    const limit = q?.limit ?? 20;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.tag.findMany({
        where,
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { questionTags: true } } },
      }),
      this.prisma.tag.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async findById(id: string) {
    const row = await this.prisma.tag.findUnique({ where: { id }, include: { _count: { select: { questionTags: true } } } });
    if (!row) throw new NotFoundException('Tag not found.');
    return row;
  }

  async create(dto: CreateTagDto) {
    const { slug, ...rest } = dto;
    try {
      return await this.prisma.tag.create({ data: { ...rest, slug: slug || slugify(dto.name) } });
    } catch (e) { throw this.mapError(e); }
  }

  async update(id: string, dto: UpdateTagDto) {
    await this.findById(id);
    const { slug, ...rest } = dto;
    const data: Prisma.TagUpdateInput = { ...rest };
    if (slug) data.slug = slug;
    else if (dto.name) data.slug = slugify(dto.name);
    try {
      return await this.prisma.tag.update({ where: { id }, data });
    } catch (e) { throw this.mapError(e); }
  }

  async remove(id: string) {
    await this.findById(id);
    try {
      await this.prisma.tag.delete({ where: { id } });
      return { id, deleted: true };
    } catch (e) { throw this.mapError(e); }
  }

  async bulkRemove(ids: string[]) {
    try {
      const res = await this.prisma.tag.deleteMany({ where: { id: { in: ids } } });
      return { deleted: res.count };
    } catch (e) { throw this.mapError(e); }
  }

  private mapError(e: unknown): Error {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2002') return new ConflictException('A tag with that name or slug already exists.');
      if (e.code === 'P2003') return new ConflictException('Cannot delete: this tag is still applied to questions.');
    }
    return e as Error;
  }
}
