import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useAuthStore } from '@/stores/auth-store';
import { tokenStore } from '@/lib/api/token-store';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('auth store (integration with auth-api + token-store)', () => {
  beforeEach(() => { useAuthStore.setState({ user: null, status: 'idle' }); tokenStore.clear(); vi.restoreAllMocks(); });
  afterEach(() => vi.restoreAllMocks());

  it('setUser transitions to authenticated', () => {
    useAuthStore.getState().setUser({ id: 'u1', email: 'a@b.com', role: 'subscriber', subscriptionTier: 'pro' });
    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(useAuthStore.getState().user?.email).toBe('a@b.com');
  });

  it('bootstrap restores a session via refresh + me', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ data: { accessToken: 'fresh' } })) // /auth/refresh
      .mockResolvedValueOnce(jsonResponse({ data: { id: 'u1', email: 'me@ce.com', role: 'subscriber', subscriptionTier: 'pro' } })); // /auth/me
    vi.stubGlobal('fetch', fetchMock);

    await useAuthStore.getState().bootstrap();
    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(useAuthStore.getState().user?.email).toBe('me@ce.com');
    expect(tokenStore.get()).toBe('fresh');
  });

  it('bootstrap ends unauthenticated when refresh fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: { code: 'X', message: 'no', statusCode: 401 } }, 401)));
    await useAuthStore.getState().bootstrap();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('logout clears the user and token', async () => {
    useAuthStore.getState().setUser({ id: 'u1', email: 'a@b.com', role: 'subscriber', subscriptionTier: 'pro' });
    tokenStore.set('tok');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ data: {} })));
    await useAuthStore.getState().logout();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(tokenStore.get()).toBeNull();
  });
});
