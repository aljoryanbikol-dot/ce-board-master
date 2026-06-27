import { describe, it, expect } from 'vitest';
import { cn, formatPercent, formatMoney, initials, timeAgo } from '@/lib/utils';

describe('cn', () => {
  it('merges and dedupes tailwind classes (last wins)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });
  it('handles conditional class values', () => {
    expect(cn('a', false && 'b', 'c')).toBe('a c');
  });
});

describe('formatPercent', () => {
  it('formats with no decimals by default', () => { expect(formatPercent(72.4)).toBe('72%'); });
  it('respects digits', () => { expect(formatPercent(72.45, 1)).toBe('72.5%'); });
});

describe('formatMoney', () => {
  it('formats PHP minor units', () => {
    const out = formatMoney(149900);
    expect(out).toContain('1,499');
  });
});

describe('initials', () => {
  it('uses two name parts', () => { expect(initials('Juan dela Cruz')).toBe('JD'); });
  it('falls back to email local part', () => { expect(initials('reviewer@ce.com')).toBe('RE'); });
});

describe('timeAgo', () => {
  it('returns just now for the present', () => { expect(timeAgo(new Date().toISOString())).toBe('just now'); });
  it('returns hours for earlier today', () => {
    const threeHrsAgo = new Date(Date.now() - 3 * 3600_000).toISOString();
    expect(timeAgo(threeHrsAgo)).toBe('3h ago');
  });
});
