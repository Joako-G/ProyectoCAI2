import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import type { MemberService } from '../../src/modules/members/member.service.js';
import { adultInput, createTestContext, minorInput } from './helpers.js';

const cleanups: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  vi.restoreAllMocks();
  while (cleanups.length > 0) await cleanups.pop()!();
});

async function listen(memberService: MemberService): Promise<string> {
  const server: Server = createApp({ memberService }).listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  cleanups.push(() => new Promise<void>((resolve) => server.close(() => resolve())));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

async function startApi() {
  const context = await createTestContext();
  cleanups.push(context.cleanup);
  const baseUrl = await listen(context.service);
  const send = (method: string, path: string, body?: unknown) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  return { baseUrl, send, ...context };
}

describe('members API', () => {
  it('serves /health', async () => {
    const { send } = await startApi();
    const response = await send('GET', '/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('creates a member with 201 and reads it back', async () => {
    const { send } = await startApi();
    const created = await send('POST', '/api/members', adultInput);
    expect(created.status).toBe(201);
    const member = await created.json();
    expect(member).toMatchObject({ firstName: 'Lucía', dni: '30123456', status: 'active', memberNumber: '0001' });

    const fetched = await send('GET', `/api/members/${member.id}`);
    expect(fetched.status).toBe(200);
    expect(await fetched.json()).toEqual(member);
  });

  it('lists members filtered by search and status', async () => {
    const { send } = await startApi();
    await send('POST', '/api/members', adultInput);
    const minor = await (await send('POST', '/api/members', minorInput)).json();
    await send('POST', `/api/members/${minor.id}/deactivate`, { reason: 'Moved away' });

    const all = await (await send('GET', '/api/members')).json();
    expect(all).toHaveLength(2);

    const bySearch = await (await send('GET', '/api/members?search=rios')).json();
    expect(bySearch.map((m: { lastName: string }) => m.lastName)).toEqual(['Ríos']);

    const inactive = await send('GET', '/api/members?status=inactive');
    expect(inactive.status).toBe(200);
    expect((await inactive.json()).map((m: { id: string }) => m.id)).toEqual([minor.id]);

    const active = await (await send('GET', '/api/members?status=active')).json();
    expect(active).toHaveLength(1);
  });

  it('rejects an invalid status filter with 400', async () => {
    const { send } = await startApi();
    const response = await send('GET', '/api/members?status=banned');
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('validation_error');
    expect(body.fieldErrors.status).toBeTruthy();
  });

  it('updates a member with 200', async () => {
    const { send } = await startApi();
    const created = await (await send('POST', '/api/members', adultInput)).json();
    const response = await send('PUT', `/api/members/${created.id}`, { ...adultInput, lastName: 'Ríos Paz' });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: created.id, lastName: 'Ríos Paz' });
  });

  it('deactivates and reactivates without ever deleting the record', async () => {
    const { send } = await startApi();
    const created = await (await send('POST', '/api/members', adultInput)).json();

    const deactivated = await send('POST', `/api/members/${created.id}/deactivate`, { reason: 'Left the club' });
    expect(deactivated.status).toBe(200);
    expect(await deactivated.json()).toMatchObject({ status: 'inactive', deactivation: { reason: 'Left the club' } });

    const listed = await (await send('GET', '/api/members')).json();
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ id: created.id, status: 'inactive' });

    const reactivated = await send('POST', `/api/members/${created.id}/reactivate`);
    expect(reactivated.status).toBe(200);
    expect(await reactivated.json()).toMatchObject({ status: 'active' });
  });

  it('exposes no delete endpoint', async () => {
    const { send } = await startApi();
    const created = await (await send('POST', '/api/members', adultInput)).json();
    const response = await send('DELETE', `/api/members/${created.id}`);
    expect(response.status).toBe(404);
    expect((await (await send('GET', '/api/members')).json())).toHaveLength(1);
  });

  it('returns 400 with fieldErrors for invalid input', async () => {
    const { send } = await startApi();
    const response = await send('POST', '/api/members', { ...adultInput, firstName: '', dni: '12' });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({ error: 'validation_error', message: 'Validation failed' });
    expect(Object.keys(body.fieldErrors)).toEqual(expect.arrayContaining(['firstName', 'dni']));
  });

  it('returns 400 when deactivating without a reason', async () => {
    const { send } = await startApi();
    const created = await (await send('POST', '/api/members', adultInput)).json();
    const response = await send('POST', `/api/members/${created.id}/deactivate`, {});
    expect(response.status).toBe(400);
    expect((await response.json()).fieldErrors.reason).toBeTruthy();
  });

  it('returns 404 for an unknown id on every id route', async () => {
    const { send } = await startApi();
    const calls: Array<[string, string, unknown?]> = [
      ['GET', '/api/members/missing'],
      ['PUT', '/api/members/missing', adultInput],
      ['POST', '/api/members/missing/deactivate', { reason: 'x' }],
      ['POST', '/api/members/missing/reactivate'],
    ];
    for (const [method, path, body] of calls) {
      const response = await send(method, path, body);
      expect(response.status, `${method} ${path}`).toBe(404);
      expect((await response.json()).error).toBe('not_found');
    }
  });

  it('returns 404 JSON for unknown /api routes', async () => {
    const { send } = await startApi();
    const response = await send('GET', '/api/unknown');
    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe('not_found');
  });

  it('returns 409 for a duplicate DNI', async () => {
    const { send } = await startApi();
    await send('POST', '/api/members', adultInput);
    const response = await send('POST', '/api/members', { ...minorInput, dni: '30.123.456' });
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe('conflict');
  });

  it('returns 409 when deactivating twice', async () => {
    const { send } = await startApi();
    const created = await (await send('POST', '/api/members', adultInput)).json();
    await send('POST', `/api/members/${created.id}/deactivate`, { reason: 'First' });
    const response = await send('POST', `/api/members/${created.id}/deactivate`, { reason: 'Second' });
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe('conflict');
  });

  it('returns 400 invalid_json for a malformed body', async () => {
    const { baseUrl } = await startApi();
    const response = await fetch(`${baseUrl}/api/members`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"firstName": ',
    });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('invalid_json');
  });

  it('returns 413 payload_too_large for a body over 100kb', async () => {
    const { send } = await startApi();
    const response = await send('POST', '/api/members', { ...adultInput, notes: 'x'.repeat(101 * 1024) });
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: 'payload_too_large', message: 'Request body is too large' });
  });

  it('maps other client body-parser errors to their 4xx status, not 500', async () => {
    const { baseUrl } = await startApi();
    const response = await fetch(`${baseUrl}/api/members`, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=bogus' },
      body: JSON.stringify(adultInput),
    });
    expect(response.status).toBe(415);
    const body = await response.json();
    expect(body.error).toBe('bad_request');
    expect(body.message).toContain('BOGUS');
  });

  it('hides internals on unexpected errors', async () => {
    const error = new Error('ENOENT: C:\\secret\\members.json');
    const failing = { list: () => Promise.reject(error) } as unknown as MemberService;
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const baseUrl = await listen(failing);

    const response = await fetch(`${baseUrl}/api/members`);
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ error: 'internal_error', message: 'Unexpected error' });
    expect(text).not.toContain('secret');
    expect(text).not.toContain('stack');
    expect(logged).toHaveBeenCalledWith(expect.anything(), error);
  });
});
