import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCurrentUser, login } from './auth-api';

const user = { id: '1', name: 'Demo', email: 'demo@example.com', role: 'secretary' };

function stubFetch(body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('auth-api capabilities', () => {
  it('merges the server capabilities into the signed-in user', async () => {
    stubFetch({ user, capabilities: ['members:read'] });

    expect(await fetchCurrentUser()).toEqual({ ...user, capabilities: ['members:read'] });
    expect(await login('demo@example.com', 'x')).toEqual({ ...user, capabilities: ['members:read'] });
  });

  it('fails closed with no capabilities and warns when the server sends none', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubFetch({ user });

    expect(await fetchCurrentUser()).toEqual({ ...user, capabilities: [] });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('capabilities'));
  });
});
