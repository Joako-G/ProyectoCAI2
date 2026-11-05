import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { createUsersFile, signIn } from '../authorization/helpers.js';

let server: Server;
let baseUrl: string;
let cleanup: () => Promise<void>;
const answer = { result: 'green' as const, reason: 'up_to_date' as const, member: { memberNumber: '0001', name: 'Ana Prueba', unpaidPeriodCount: 0 } };
const check = vi.fn(async (_dni: string) => answer);

beforeAll(async () => {
  const users = await createUsersFile();
  cleanup = users.cleanup;
  server = createApp({ storePath: users.storePath, accessService: { check } }).listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
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
    expect(check).toHaveBeenCalledWith('30111222');
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
