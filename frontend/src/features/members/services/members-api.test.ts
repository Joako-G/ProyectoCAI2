import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, buildMember } from '../test/fixtures';
import { ApiError, fetchMembers } from './members-api';

const fetchMock = vi.fn<typeof fetch>();

function stubFetch(response: Response) {
  fetchMock.mockResolvedValueOnce(response);
  vi.stubGlobal('fetch', fetchMock);
}

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('fetchMembers', () => {
  it('requests /api/members with encoded search and status', async () => {
    stubFetch(jsonResponse([]));

    await fetchMembers({ search: 'ríos 7', status: 'inactive' });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/members?search=r%C3%ADos+7&status=inactive');
  });

  it('omits empty search and the "all" status', async () => {
    stubFetch(jsonResponse([]));

    await fetchMembers({ search: '  ', status: 'all' });

    expect(fetchMock.mock.calls[0][0]).toBe('/api/members');
  });

  it('returns the parsed members', async () => {
    const members = [buildMember()];
    stubFetch(jsonResponse(members));

    await expect(fetchMembers({ search: '', status: 'all' })).resolves.toEqual(members);
  });

  it('passes the abort signal to fetch', async () => {
    stubFetch(jsonResponse([]));
    const controller = new AbortController();

    await fetchMembers({ search: '', status: 'all' }, controller.signal);

    expect(fetchMock.mock.calls[0][1]?.signal).toBe(controller.signal);
  });

  it('throws an ApiError carrying the backend error contract', async () => {
    stubFetch(jsonResponse({ error: 'validation_error', message: 'Invalid status' }, 400));

    await expect(fetchMembers({ search: '', status: 'all' })).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      code: 'validation_error',
      message: 'Invalid status',
    });
  });

  it('throws a generic ApiError when the error body is not the contract', async () => {
    stubFetch(new Response('<html>Bad gateway</html>', { status: 502 }));

    const error = await fetchMembers({ search: '', status: 'all' }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 502, code: 'unknown_error' });
  });

  it('propagates network failures', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchMembers({ search: '', status: 'all' })).rejects.toThrow('Failed to fetch');
  });
});
