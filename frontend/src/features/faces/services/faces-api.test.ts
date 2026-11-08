import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../members/services/members-api';
import { jsonResponse } from '../../members/test/fixtures';
import { DESCRIPTOR } from '../test/fakes';
import { enrollFace, getFaceStatus, getFaceSummary, removeFace } from './faces-api';

afterEach(() => vi.unstubAllGlobals());

function stubFetch(response: Response) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('faces api', () => {
  it('reads whether a member has a face enrolled', async () => {
    const fetchMock = stubFetch(jsonResponse({ enrolled: true, enrolledAt: '2026-11-07T15:00:00.000Z' }));
    expect(await getFaceStatus('member 1')).toEqual({ enrolled: true, enrolledAt: '2026-11-07T15:00:00.000Z' });
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/faces/member%201');
  });

  it('reads how many faces are enrolled', async () => {
    const fetchMock = stubFetch(jsonResponse({ enrolled: 312 }));
    expect(await getFaceSummary()).toEqual({ enrolled: 312 });
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/faces/summary');
  });

  it('enrolls with the descriptor and the confirmed consent, and nothing else', async () => {
    const fetchMock = stubFetch(new Response(null, { status: 204 }));
    await enrollFace('m1', DESCRIPTOR);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/faces/m1');
    expect(init).toMatchObject({ method: 'PUT' });
    expect(JSON.parse(String(init!.body))).toEqual({ descriptor: DESCRIPTOR, consent: true });
  });

  it('removes the face with a DELETE', async () => {
    const fetchMock = stubFetch(new Response(null, { status: 204 }));
    await removeFace('m1');
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ method: 'DELETE' });
  });

  it('surfaces faces_unavailable as an ApiError with status 503', async () => {
    stubFetch(jsonResponse({ error: 'faces_unavailable', message: 'not configured' }, 503));
    await expect(getFaceStatus('m1')).rejects.toMatchObject({ status: 503, code: 'faces_unavailable' });
    await expect(getFaceStatus('m1')).rejects.toBeInstanceOf(ApiError);
  });
});
