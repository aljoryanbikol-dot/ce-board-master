import { describe, it, expect } from 'vitest';
import { isAdminRole } from '@/lib/auth/types';

describe('isAdminRole', () => {
  it('admits admin roles', () => {
    expect(isAdminRole('admin')).toBe(true);
    expect(isAdminRole('super_admin')).toBe(true);
    expect(isAdminRole('content_author')).toBe(true);
    expect(isAdminRole('reviewer')).toBe(true);
  });
  it('rejects learner roles', () => {
    expect(isAdminRole('subscriber')).toBe(false);
    expect(isAdminRole('free_user')).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
  });
});
