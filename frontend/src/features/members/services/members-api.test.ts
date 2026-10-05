import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, buildMember } from '../test/fixtures';
import {
  ApiError,
  createMember,
  deactivateMember,
  fetchMembers,
  getMember,
  reactivateMember,
  updateMember,
} from './members-api';
import type { MemberInput } from '../types/member';

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

const input: MemberInput = {
  firstName: 'Lucía',
  lastName: 'Ríos',
  dni: '30123456',
  birthDate: '1990-03-15',
  category: 'Mayor',
  memberSince: '2015-02-01',
  whatsapp: '1155551234',
};

function lastRequest() {
  const [url, init] = fetchMock.mock.calls[0];
  return { url, init, body: init?.body ? JSON.parse(String(init.body)) : undefined };
}

describe('member detail and mutations', () => {
  it('getMember requests the member by encoded id', async () => {
    const member = buildMember();
    stubFetch(jsonResponse(member));

    await expect(getMember('a/b c')).resolves.toEqual(member);
    expect(lastRequest().url).toBe('/api/members/a%2Fb%20c');
  });

  it('getMember passes the abort signal', async () => {
    stubFetch(jsonResponse(buildMember()));
    const controller = new AbortController();

    await getMember('member-1', controller.signal);

    expect(fetchMock.mock.calls[0][1]?.signal).toBe(controller.signal);
  });

  it('createMember POSTs the JSON body and returns the created member', async () => {
    const created = buildMember({ id: 'new' });
    stubFetch(jsonResponse(created, 201));

    await expect(createMember(input)).resolves.toEqual(created);

    const { url, init, body } = lastRequest();
    expect(url).toBe('/api/members');
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json');
    expect(body).toEqual(input);
  });

  it('updateMember PUTs the JSON body to the member', async () => {
    stubFetch(jsonResponse(buildMember()));

    await updateMember('member-1', input);

    const { url, init, body } = lastRequest();
    expect(url).toBe('/api/members/member-1');
    expect(init?.method).toBe('PUT');
    expect(body).toEqual(input);
  });

  it('deactivateMember POSTs the reason', async () => {
    stubFetch(jsonResponse(buildMember({ status: 'inactive' })));

    await deactivateMember('member-1', 'Mudanza');

    const { url, init, body } = lastRequest();
    expect(url).toBe('/api/members/member-1/deactivate');
    expect(init?.method).toBe('POST');
    expect(body).toEqual({ reason: 'Mudanza' });
  });

  it('reactivateMember POSTs without a body', async () => {
    stubFetch(jsonResponse(buildMember()));

    await reactivateMember('member-1');

    const { url, init } = lastRequest();
    expect(url).toBe('/api/members/member-1/reactivate');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeUndefined();
  });

  it('keeps fieldErrors from a 400 validation_error on the ApiError', async () => {
    stubFetch(
      jsonResponse(
        {
          error: 'validation_error',
          message: 'Validation failed',
          fieldErrors: { dni: 'DNI must have 7 or 8 digits', 'guardian.name': 'Guardian name is required' },
        },
        400,
      ),
    );

    const error = await createMember(input).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      code: 'validation_error',
      fieldErrors: { dni: 'DNI must have 7 or 8 digits', 'guardian.name': 'Guardian name is required' },
    });
  });

  it('exposes a 409 conflict and defaults fieldErrors to empty', async () => {
    stubFetch(jsonResponse({ error: 'conflict', message: 'A member with this DNI already exists' }, 409));

    const error = await createMember(input).catch((e: unknown) => e);

    expect(error).toMatchObject({ status: 409, code: 'conflict', fieldErrors: {} });
  });
});
