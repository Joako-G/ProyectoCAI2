import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../../members/test/fixtures';
import { DESCRIPTOR } from '../test/fakes';
import { cancelEnrollment, completeEnrollment, getActiveEnrollment, getEnrollment, getEnrollmentDisplay, openEnrollment, reportEnrollmentProgress } from './enrollment-api';

afterEach(() => vi.unstubAllGlobals());

function stubFetch(response: Response) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const session = { id: 's 1', memberId: 'm1', firstName: 'Ana', status: 'waiting', hint: '', captures: 0, total: 3, expiresAt: '2026-11-09T15:02:00.000Z' };

describe('enrollment api', () => {
  it('asks whether a public screen is connected', async () => {
    const fetchMock = stubFetch(jsonResponse({ connected: true }));
    expect(await getEnrollmentDisplay()).toEqual({ connected: true });
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/faces/enrollments/display');
  });

  it('opens a session with the member and the confirmed consent, and returns the session', async () => {
    const fetchMock = stubFetch(jsonResponse({ session }, 201));
    expect(await openEnrollment('m1')).toEqual(session);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/faces/enrollments');
    expect(init).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(init!.body))).toEqual({ memberId: 'm1', consent: true });
  });

  it('reads the active session and one session by id', async () => {
    let fetchMock = stubFetch(jsonResponse({ session: null }));
    expect(await getActiveEnrollment()).toEqual({ session: null });
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/faces/enrollments/active');
    fetchMock = stubFetch(jsonResponse(session));
    expect(await getEnrollment('s 1')).toEqual(session);
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/faces/enrollments/s%201');
  });

  it('reports progress, delivers only the descriptor, and cancels', async () => {
    let fetchMock = stubFetch(jsonResponse(session));
    await reportEnrollmentProgress('s1', { status: 'capturing', hint: 'Acercate', captures: 1 });
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/faces/enrollments/s1/progress');
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body))).toEqual({ status: 'capturing', hint: 'Acercate', captures: 1 });

    fetchMock = stubFetch(new Response(null, { status: 204 }));
    await completeEnrollment('s1', DESCRIPTOR);
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/faces/enrollments/s1/complete');
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body))).toEqual({ descriptor: DESCRIPTOR });

    fetchMock = stubFetch(new Response(null, { status: 204 }));
    await cancelEnrollment('s1');
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/faces/enrollments/s1/cancel');
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ method: 'POST' });
  });
});
