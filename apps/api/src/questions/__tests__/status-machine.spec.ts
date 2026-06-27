/**
 * @file status-machine.spec.ts
 * @module Questions/Tests
 */
import { describe, it, expect } from 'vitest';
import { ReviewAction } from '@prisma/client';
import { findTransition, TRANSITIONS } from '../constants/status-machine';

describe('status-machine', () => {
  it('allows draft → submit', () => {
    const t = findTransition('draft', ReviewAction.submit);
    expect(t?.to).toBe('in_review');
    expect(t?.permission).toBe('questions.update');
  });

  it('allows in_review → approve → approved', () => {
    const t = findTransition('in_review', ReviewAction.approve);
    expect(t?.to).toBe('approved');
  });

  it('allows in_review → reject → draft', () => {
    expect(findTransition('in_review', ReviewAction.reject)?.to).toBe('draft');
  });

  it('allows approved → publish → published', () => {
    const t = findTransition('approved', ReviewAction.publish);
    expect(t?.to).toBe('published');
    expect(t?.permission).toBe('questions.publish');
  });

  it('allows published → archive and published → flag', () => {
    expect(findTransition('published', ReviewAction.archive)?.to).toBe('archived');
    expect(findTransition('published', ReviewAction.flag)?.to).toBe('flagged');
  });

  it('allows flagged → unflag → published', () => {
    expect(findTransition('flagged', ReviewAction.unflag)?.to).toBe('published');
  });

  it('rejects illegal transitions', () => {
    expect(findTransition('draft', ReviewAction.publish)).toBeUndefined();
    expect(findTransition('archived', ReviewAction.submit)).toBeUndefined();
    expect(findTransition('published', ReviewAction.submit)).toBeUndefined();
  });

  it('treats archived as terminal (no outgoing transitions)', () => {
    expect(TRANSITIONS.archived).toHaveLength(0);
  });
});
