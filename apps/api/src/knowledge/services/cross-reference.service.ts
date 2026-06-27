/**
 * @file cross-reference.service.ts
 * @module Knowledge/Services
 *
 * CrossReferenceService — owns the knowledge dependency graph. Stores edges
 * between knowledge entities (LO ↔ formula ↔ blueprint ↔ misconception ↔
 * document) and traverses them to build dependency graphs.
 *
 * Cycle protection: adding a prerequisite edge that would create a cycle is
 * rejected (the LO prerequisite graph must stay a DAG). General cross-references
 * (lo_to_formula etc.) are not cycle-checked since they are cross-type and
 * cannot form a prerequisite loop.
 */
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { KnowledgeErrors } from '../knowledge.errors';
import { EVENTS } from '../../common/constants';
import { KNOWLEDGE_GRAPH_MAX_DEPTH } from '../constants/knowledge.constants';
import type { CreateCrossReferenceDto } from '../dto/knowledge.dto';
import type { CrossReferenceView, DependencyGraph, GraphNode, GraphEdge } from '../types/knowledge.types';
import type { AuthenticatedUser } from '../../auth/auth.types';

@Injectable()
export class CrossReferenceService {
  private readonly logger = new Logger(CrossReferenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateCrossReferenceDto, user: AuthenticatedUser): Promise<CrossReferenceView> {
    const existing = await this.prisma.knowledgeCrossReference.findFirst({
      where: { fromType: dto.fromType, fromId: dto.fromId, toType: dto.toType, toId: dto.toId, referenceType: dto.referenceType as never },
    });
    if (existing) throw KnowledgeErrors.crossRefExists();

    // DAG guard for prerequisite edges.
    if (dto.referenceType === 'lo_prerequisite') {
      const wouldCycle = await this.createsCycle(dto.fromId, dto.toId);
      if (wouldCycle) throw KnowledgeErrors.cycleDetected(`${dto.fromPublicId ?? dto.fromId} → ${dto.toPublicId ?? dto.toId}`);
    }

    const ref = await this.prisma.knowledgeCrossReference.create({
      data: {
        referenceType: dto.referenceType as never,
        fromType: dto.fromType, fromId: dto.fromId, fromPublicId: dto.fromPublicId ?? null,
        toType: dto.toType, toId: dto.toId, toPublicId: dto.toPublicId ?? null,
        weight: dto.weight, note: dto.note ?? null, createdBy: user.id,
      },
    });
    this.eventEmitter.emit(EVENTS.KNOWLEDGE_XREF_CREATED, { id: ref.id, referenceType: dto.referenceType, actorId: user.id, timestamp: new Date().toISOString() });
    this.logger.log({ message: 'Cross-reference created', referenceType: dto.referenceType, fromId: dto.fromId, toId: dto.toId });
    return this.toView(ref);
  }

  async remove(id: string): Promise<void> {
    const ref = await this.prisma.knowledgeCrossReference.findUnique({ where: { id } });
    if (!ref) throw KnowledgeErrors.crossRefNotFound(id);
    await this.prisma.knowledgeCrossReference.delete({ where: { id } });
  }

  async listForEntity(type: string, id: string): Promise<{ outgoing: CrossReferenceView[]; incoming: CrossReferenceView[] }> {
    const [outgoing, incoming] = await Promise.all([
      this.prisma.knowledgeCrossReference.findMany({ where: { fromType: type, fromId: id } }),
      this.prisma.knowledgeCrossReference.findMany({ where: { toType: type, toId: id } }),
    ]);
    return {
      outgoing: outgoing.map((r: (typeof outgoing)[number]) => this.toView(r)),
      incoming: incoming.map((r: (typeof incoming)[number]) => this.toView(r)),
    };
  }

  /**
   * Build a dependency graph rooted at an entity by following outgoing edges
   * breadth-first up to maxDepth. Returns nodes + edges suitable for a graph UI.
   */
  async buildGraph(rootType: string, rootId: string, maxDepth: number = KNOWLEDGE_GRAPH_MAX_DEPTH): Promise<DependencyGraph> {
    const depthCap = Math.min(maxDepth, KNOWLEDGE_GRAPH_MAX_DEPTH);
    const nodes = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];
    const visited = new Set<string>();
    let frontier: { type: string; id: string }[] = [{ type: rootType, id: rootId }];
    let depth = 0;

    nodes.set(rootId, { id: rootId, type: rootType, publicId: null, label: rootId });

    while (frontier.length > 0 && depth < depthCap) {
      const next: { type: string; id: string }[] = [];
      for (const node of frontier) {
        if (visited.has(node.id)) continue;
        visited.add(node.id);

        const outgoing = await this.prisma.knowledgeCrossReference.findMany({ where: { fromType: node.type, fromId: node.id } });
        for (const e of outgoing) {
          if (!nodes.has(e.toId)) {
            nodes.set(e.toId, { id: e.toId, type: e.toType, publicId: e.toPublicId, label: e.toPublicId ?? e.toId });
            next.push({ type: e.toType, id: e.toId });
          }
          edges.push({ from: e.fromId, to: e.toId, referenceType: e.referenceType, weight: e.weight });
        }
      }
      frontier = next;
      depth++;
    }

    return { rootId, nodes: Array.from(nodes.values()), edges, depth };
  }

  /** Returns true if adding from→to (prerequisite) would create a cycle, i.e.
   *  `to` already reaches `from` through existing prerequisite edges. */
  private async createsCycle(fromId: string, toId: string): Promise<boolean> {
    if (fromId === toId) return true;
    const visited = new Set<string>();
    let frontier = [toId];
    let depth = 0;
    while (frontier.length > 0 && depth < KNOWLEDGE_GRAPH_MAX_DEPTH * 4) {
      const next: string[] = [];
      for (const id of frontier) {
        if (id === fromId) return true;
        if (visited.has(id)) continue;
        visited.add(id);
        const edges = await this.prisma.knowledgeCrossReference.findMany({
          where: { fromId: id, referenceType: 'lo_prerequisite' as never },
          select: { toId: true },
        });
        for (const e of edges) next.push(e.toId);
      }
      frontier = next;
      depth++;
    }
    return false;
  }

  private toView(r: {
    id: string; referenceType: string; fromType: string; fromId: string; fromPublicId: string | null;
    toType: string; toId: string; toPublicId: string | null; weight: number; note: string | null; createdAt: Date;
  }): CrossReferenceView {
    return {
      id: r.id, referenceType: r.referenceType, fromType: r.fromType, fromId: r.fromId, fromPublicId: r.fromPublicId,
      toType: r.toType, toId: r.toId, toPublicId: r.toPublicId, weight: r.weight, note: r.note, createdAt: r.createdAt.toISOString(),
    };
  }
}
