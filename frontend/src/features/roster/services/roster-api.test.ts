import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../../members/test/fixtures';
import { buildRoster } from '../test/fixtures';
import { fetchRoster } from './roster-api';

afterEach(() => vi.unstubAllGlobals());

describe('fetchRoster', () => {
  it('requests /api/roster with no parameters: the server knows the teacher from the session', async () => {
    const fetchMock = vi.fn(async () => jsonResponse([buildRoster()]));
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchRoster()).toEqual([buildRoster()]);
    expect(fetchMock).toHaveBeenCalledWith('/api/roster', { signal: undefined });
  });

  it('rejects on an error status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'Forbidden' }, 403)));
    await expect(fetchRoster()).rejects.toThrow();
  });
});
