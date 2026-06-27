import { describe, it, expect, beforeEach } from 'vitest';
import { DifficultyScalingService } from '../services/difficulty-scaling.service';

describe('DifficultyScalingService', () => {
  let svc: DifficultyScalingService;
  beforeEach(() => { svc = new DifficultyScalingService(); });

  it('maps bands to an ordered scale', () => {
    expect(svc.toScale('foundation')).toBe(1);
    expect(svc.toScale('board_level')).toBe(5);
  });
  it('normalizes unknown bands to moderate', () => {
    expect(svc.normalizeBand('nonsense')).toBe('moderate');
    expect(svc.normalizeBand(null)).toBe('moderate');
    expect(svc.normalizeBand('difficult')).toBe('difficult');
  });
  it('shifts bands within range, clamped', () => {
    expect(svc.shift('moderate', 1)).toBe('difficult');
    expect(svc.shift('foundation', -3)).toBe('foundation');
    expect(svc.shift('board_level', 5)).toBe('board_level');
  });
  it('scales solving time with difficulty', () => {
    expect(svc.estimatedSolvingTimeSec('foundation')).toBeLessThan(svc.estimatedSolvingTimeSec('board_level'));
  });
  it('scales parameter magnitude with difficulty', () => {
    expect(svc.parameterMagnitude('board_level')).toBeGreaterThan(svc.parameterMagnitude('easy'));
  });
});
