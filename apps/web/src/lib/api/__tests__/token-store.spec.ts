import { describe, it, expect, beforeEach, vi } from 'vitest';
import { tokenStore } from '@/lib/api/token-store';

describe('tokenStore', () => {
  beforeEach(() => tokenStore.clear());

  it('stores and returns the access token', () => {
    tokenStore.set('abc');
    expect(tokenStore.get()).toBe('abc');
  });

  it('clears the token', () => {
    tokenStore.set('abc');
    tokenStore.clear();
    expect(tokenStore.get()).toBeNull();
  });

  it('notifies subscribers on change', () => {
    const spy = vi.fn();
    const unsub = tokenStore.subscribe(spy);
    tokenStore.set('xyz');
    expect(spy).toHaveBeenCalledWith('xyz');
    unsub();
    tokenStore.set('def');
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
