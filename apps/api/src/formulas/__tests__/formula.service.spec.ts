/**
 * @file formula.service.spec.ts
 * @module Formulas/Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { FormulaService } from '../services/formula.service';
import { PublicIdService } from '../../knowledge/services/public-id.service';
import { ValidationEngineService } from '../../knowledge/services/validation-engine.service';

const user = { id: 'u-1', email: 'a@b.com', role: 'content_admin', subscriptionTier: 'pro' as const };
const mockPrisma = { formulaLibrary: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() } };
const mockCache = { invalidatePattern: vi.fn() };

const fRow = {
  id: 'f-1', name: 'Normal Stress Equation', slug: 'normal-stress-equation', subjectId: 's-1', topicId: null,
  expressionText: 'σ = P / A', expressionLatex: '\\sigma = P/A', variables: { _formulaId: 'ST-F-0015', items: [] },
  unitsSystem: 'SI', assumptions: [], typicalApplications: [], isActive: true, createdAt: new Date(), updatedAt: new Date(),
};

const build = () => new FormulaService(mockPrisma as never, mockCache as never, new ValidationEngineService(new PublicIdService()));

describe('FormulaService', () => {
  let svc: FormulaService;
  beforeEach(() => { vi.clearAllMocks(); svc = build(); });

  it('creates a formula and validates the governing Formula ID', async () => {
    mockPrisma.formulaLibrary.findFirst.mockResolvedValue(null);
    mockPrisma.formulaLibrary.create.mockResolvedValue(fRow);
    const result = await svc.create({ formulaId: 'ST-F-0015', name: 'Normal Stress Equation', subjectId: 's-1', expressionText: 'σ = P / A', expressionLatex: '\\sigma = P/A', variables: [], unitsSystem: 'SI', assumptions: [], typicalApplications: [] } as never, user);
    expect(result.formulaId).toBe('ST-F-0015');
    expect(result.name).toBe('Normal Stress Equation');
  });

  it('rejects an invalid Formula ID', async () => {
    const err = await svc.create({ formulaId: 'BAD-ID', name: 'X Equation', subjectId: 's-1', expressionText: 'a=b', expressionLatex: 'a=b', variables: [], unitsSystem: 'SI', assumptions: [], typicalApplications: [] } as never, user).catch((e) => e);
    expect(err).toBeInstanceOf(UnprocessableEntityException);
    expect(err.getResponse().code).toBe('VALIDATION_FAILED');
  });

  it('rejects a duplicate name/slug', async () => {
    mockPrisma.formulaLibrary.findFirst.mockResolvedValue({ id: 'existing' });
    await expect(svc.create({ name: 'Normal Stress Equation', subjectId: 's-1', expressionText: 'σ = P / A', expressionLatex: '\\sigma = P/A', variables: [], unitsSystem: 'SI', assumptions: [], typicalApplications: [] } as never, user)).rejects.toThrow(ConflictException);
  });

  it('allows creation without a Formula ID (optional)', async () => {
    mockPrisma.formulaLibrary.findFirst.mockResolvedValue(null);
    mockPrisma.formulaLibrary.create.mockResolvedValue({ ...fRow, variables: { items: [] } });
    const result = await svc.create({ name: 'Bernoulli Equation', subjectId: 's-1', expressionText: 'p + ...', expressionLatex: 'p', variables: [], unitsSystem: 'SI', assumptions: [], typicalApplications: [] } as never, user);
    expect(result.formulaId).toBeNull();
  });

  it('search returns active formulas', async () => {
    mockPrisma.formulaLibrary.findMany.mockResolvedValue([fRow]);
    mockPrisma.formulaLibrary.count.mockResolvedValue(1);
    const result = await svc.search({ q: 'stress', limit: 20 } as never);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.formulaId).toBe('ST-F-0015');
  });

  it('deactivate flips isActive', async () => {
    mockPrisma.formulaLibrary.findUnique.mockResolvedValue({ id: 'f-1' });
    mockPrisma.formulaLibrary.update.mockResolvedValue({});
    await svc.deactivate('f-1');
    expect(mockPrisma.formulaLibrary.update).toHaveBeenCalledWith(expect.objectContaining({ data: { isActive: false } }));
  });
});
