/**
 * @file difficulty-scaling.service.ts
 * @module AI/Services
 *
 * DifficultyScalingService — pure difficulty arithmetic. Maps difficulty bands
 * to a numeric scale, scales solving time and parameter magnitude, and resolves
 * a blueprint's declared difficulty band into the engine's scale. No I/O.
 */
import { Injectable } from '@nestjs/common';
import { DIFFICULTY_BANDS, DIFFICULTY_SCALE, type DifficultyBand } from '../constants/ai.constants';

@Injectable()
export class DifficultyScalingService {
  toScale(band: DifficultyBand): number {
    return DIFFICULTY_SCALE[band];
  }

  /** Clamp + normalize an arbitrary band string to a known band. */
  normalizeBand(band?: string | null): DifficultyBand {
    const found = DIFFICULTY_BANDS.find((b) => b === band);
    return found ?? 'moderate';
  }

  /** Step a band up or down by n levels, clamped to the band range. */
  shift(band: DifficultyBand, delta: number): DifficultyBand {
    const idx = DIFFICULTY_BANDS.indexOf(band);
    const next = Math.max(0, Math.min(DIFFICULTY_BANDS.length - 1, idx + delta));
    return DIFFICULTY_BANDS[next]!;
  }

  /** Estimated solving time grows with difficulty. */
  estimatedSolvingTimeSec(band: DifficultyBand, baseSec = 60): number {
    return baseSec + this.toScale(band) * 30;
  }

  /** A multiplier for numerical operand magnitude based on difficulty. */
  parameterMagnitude(band: DifficultyBand): number {
    return this.toScale(band);
  }
}
