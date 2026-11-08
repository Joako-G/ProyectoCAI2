import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { createUsersFile, signIn } from '../authorization/helpers.js';

let server: Server;
let withoutEntries: Server;
let withoutEntriesUrl: string;
let baseUrl: string;
let cleanup: () => Promise<void>;
const answer = { result: 'green' as const, reason: 'up_to_date' as const, member: { memberNumber: '0001', name: 'Ana Prueba', unpaidPeriodCount: 0 } };
const day = { date: '2026-11-07', count: 1, entries: [{ id: 'e1', checkedAt: '2026-11-07T14:00:00.000Z', memberNumber: '0001', name: 'Ana Prueba', method: 'dni' as const, result: 'green' as const }] };
const listEntries = vi.fn(async (_date?: string) => day);
const check = vi.fn(async (_dni: string, _entry?: { method: 'dni' | 'face'; actorId: string }) => answer);

beforeAll(async () => {
  const users = await createUsersFile();
  cleanup = users.cleanup;
  server = createApp({ storePath: users.storePath, accessService: { check }, accessEntries: { list: listEntries } }).listen(0);
  withoutEntries = createApp({ storePath: users.storePath, accessService: { check } }).listen(0);
  await Promise.all([server, withoutEntries].map((listening) => new Promise<void>((resolve) => listening.once('listening', resolve))));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  withoutEntriesUrl = `http://127.0.0.1:${(withoutEntries.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await Promise.all([server, withoutEntries].map((closing) => new Promise<void>((resolve) => closing.close(() => resolve()))));
  await cleanup();
});

function post(body: unknown, cookie?: string) {
  return fetch(`${baseUrl}/api/access/check`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

describe('POST /api/access/check', () => {
  it('answers 401 without a session and 403 to a teacher', async () => {
    expect((await post({ dni: '30111222' })).status).toBe(401);
    expect((await post({ dni: '30111222' }, await signIn(baseUrl, 'teacher'))).status).toBe(403);
  });

  it('returns the service answer to the secretary and the head secretary', async () => {
    for (const role of ['secretary', 'head_secretary'] as const) {
      const response = await post({ dni: '30111222' }, await signIn(baseUrl, role));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(answer);
    }
  });

  it('accepts a DNI typed with dots and passes only its digits on', async () => {
    check.mockClear();
    await post({ dni: '30.111.222' }, await signIn(baseUrl, 'secretary'));
    expect(check).toHaveBeenCalledWith('30111222', { method: 'dni', actorId: 'user-secretary' });
  });

  it.each([{}, { dni: '' }, { dni: '123' }, { dni: '123456789' }, { dni: 'abcdefgh' }, { dni: 30111222 }])('rejects %j with 400 and never echoes the input', async (body) => {
    check.mockClear();
    const response = await post(body, await signIn(baseUrl, 'secretary'));
    expect(response.status).toBe(400);
    const text = await response.text();
    expect(JSON.parse(text)).toMatchObject({ error: 'validation_error', fieldErrors: { dni: 'DNI must have 7 or 8 digits' } });
    for (const value of Object.values(body)) if (String(value) !== '') expect(text).not.toContain(String(value));
    expect(check).not.toHaveBeenCalled();
  });

  it('does not log the DNI', async () => {
    const spies = (['log', 'info', 'warn', 'error'] as const).map((method) => vi.spyOn(console, method).mockImplementation(() => undefined));
    const cookie = await signIn(baseUrl, 'secretary');
    await post({ dni: '30111222' }, cookie);
    await post({ dni: '12' }, cookie);
    for (const spy of spies) expect(JSON.stringify(spy.mock.calls)).not.toMatch(/30111222|"12"/);
    vi.restoreAllMocks();
  });
});

function getEntries(query: string, cookie?: string, url = baseUrl) {
  return fetch(`${url}/api/access/entries${query}`, { headers: cookie ? { cookie } : {} });
}

describe('GET /api/access/entries', () => {
  it('answers 401 without a session and 403 to a teacher', async () => {
    expect((await getEntries('')).status).toBe(401);
    expect((await getEntries('', await signIn(baseUrl, 'teacher'))).status).toBe(403);
  });

  it('returns the day to the secretary and the head secretary, today by default', async () => {
    for (const role of ['secretary', 'head_secretary'] as const) {
      listEntries.mockClear();
      const response = await getEntries('', await signIn(baseUrl, role));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(day);
      expect(listEntries).toHaveBeenCalledWith(undefined);
    }
  });

  it('passes a valid date on', async () => {
    listEntries.mockClear();
    await getEntries('?date=2026-11-06', await signIn(baseUrl, 'secretary'));
    expect(listEntries).toHaveBeenCalledWith('2026-11-06');
  });

  it.each(['?date=yesterday', '?date=2026-13-40', '?date=2026-02-30', '?date=2026-11-07&date=2026-11-08', '?date='])('rejects %s with 400', async (query) => {
    listEntries.mockClear();
    const response = await getEntries(query, await signIn(baseUrl, 'secretary'));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'validation_error', fieldErrors: { date: 'Date must be YYYY-MM-DD' } });
    expect(listEntries).not.toHaveBeenCalled();
  });

  it('answers 503 entries_unavailable when the server has no database', async () => {
    const response = await getEntries('', await signIn(withoutEntriesUrl, 'secretary'), withoutEntriesUrl);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: 'entries_unavailable' });
  });

  it('answers 503 when reading the log fails, without leaking the cause', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    listEntries.mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:5432 password=secret'));
    const response = await getEntries('', await signIn(baseUrl, 'secretary'));
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(JSON.parse(text)).toMatchObject({ error: 'entries_unavailable' });
    expect(text).not.toMatch(/ECONNREFUSED|secret/);
    vi.restoreAllMocks();
  });
});
