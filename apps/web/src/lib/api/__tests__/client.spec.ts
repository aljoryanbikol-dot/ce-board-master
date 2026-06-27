import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { api } from '@/lib/api/client';
import { ApiError } from '@/lib/api/types';
import { tokenStore } from '@/lib/api/token-store';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('api client', () => {
  beforeEach(() => { tokenStore.clear(); vi.restoreAllMocks(); });
  afterEach(() => vi.restoreAllMocks());

  it('unwraps the { data, meta } success envelope', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ data: { hello: 'world' }, meta: { requestId: 'r1' } })));
    const res = await api.get<{ hello: string }>('/thing');
    expect(res.data).toEqual({ hello: 'world' });
    expect(res.meta?.requestId).toBe('r1');
  });

  it('throws a typed ApiError on the error envelope', async () => {
    // Fresh Response per call — a Response body can only be read once.
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ error: { code: 'NOT_FOUND', message: 'Missing', statusCode: 404 } }, 404))));
    await expect(api.get('/missing')).rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    try { await api.get('/missing'); } catch (e) { expect(e).toBeInstanceOf(ApiError); expect((e as ApiError).isNotFound).toBe(true); }
  });

  it('attaches the bearer token when present', async () => {
    tokenStore.set('tok-123');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: {} }));
    vi.stubGlobal('fetch', fetchMock);
    await api.get('/secure');
    const headers = (fetchMock.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer tok-123');
  });

  it('refreshes once on 401 then replays the original request', async () => {
    tokenStore.set('expired');
    const fetchMock = vi.fn()
      // 1: original → 401
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'UNAUTHORIZED', message: 'expired', statusCode: 401 } }, 401))
      // 2: refresh → new token
      .mockResolvedValueOnce(jsonResponse({ data: { accessToken: 'fresh' } }))
      // 3: replay → success
      .mockResolvedValueOnce(jsonResponse({ data: { ok: true } }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await api.get<{ ok: boolean }>('/secure');
    expect(res.data).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(tokenStore.get()).toBe('fresh');
    // The replay used the refreshed token.
    const replayHeaders = (fetchMock.mock.calls[2]![1] as RequestInit).headers as Record<string, string>;
    expect(replayHeaders.authorization).toBe('Bearer fresh');
  });

  it('clears the token when refresh fails on 401', async () => {
    tokenStore.set('expired');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'UNAUTHORIZED', message: 'expired', statusCode: 401 } }, 401))
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'UNAUTHORIZED', message: 'no', statusCode: 401 } }, 401)); // refresh fails
    vi.stubGlobal('fetch', fetchMock);
    await expect(api.get('/secure')).rejects.toBeInstanceOf(ApiError);
    expect(tokenStore.get()).toBeNull();
  });

  it('does not attach auth or refresh when skipAuth is set', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { token: 'x' } }));
    vi.stubGlobal('fetch', fetchMock);
    await api.post('/auth/login', { email: 'a' }, { skipAuth: true });
    const headers = (fetchMock.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
    expect(headers.authorization).toBeUndefined();
  });
});
