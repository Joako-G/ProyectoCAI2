import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import type { MemberRepository } from '../../src/modules/members/member.repository.js';
import { createMemberService } from '../../src/modules/members/member.service.js';
import { basketball, createTestContext, volleyball } from './helpers.js';

const cleanups: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()!();
});

async function startApi() {
  const context = await createTestContext();
  cleanups.push(context.cleanup);
  const memberRepository: MemberRepository = {
    list: async () => [],
    mutate: async (change) => change([]).result,
  };
  const app = createApp({
    memberService: createMemberService({ repository: memberRepository, disciplineLookup: context.service }),
    disciplineService: context.service,
  });
  const server: Server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  cleanups.push(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const send = (method: string, path: string, body?: unknown) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  return { send, ...context };
}

describe('disciplines API', () => {
  it('creates a discipline with 201 and reads it back', async () => {
    const { send } = await startApi();
    const created = await send('POST', '/api/disciplines', basketball);
    expect(created.status).toBe(201);
    const discipline = await created.json();
    expect(discipline).toMatchObject({
      name: 'Básquet',
      teachers: ['Marcos Ledesma'],
      leadTeacher: 'Marcos Ledesma',
      status: 'active',
    });

    const fetched = await send('GET', `/api/disciplines/${discipline.id}`);
    expect(fetched.status).toBe(200);
    expect(await fetched.json()).toEqual(discipline);
  });

  it('lists disciplines filtered by search and status', async () => {
    const { send } = await startApi();
    await send('POST', '/api/disciplines', volleyball);
    const basket = await (await send('POST', '/api/disciplines', basketball)).json();
    await send('POST', `/api/disciplines/${basket.id}/deactivate`);

    const all = await (await send('GET', '/api/disciplines')).json();
    expect(all.map((d: { name: string }) => d.name)).toEqual(['Básquet', 'Vóley']);

    const inactive = await (await send('GET', '/api/disciplines?status=inactive')).json();
    expect(inactive.map((d: { id: string }) => d.id)).toEqual([basket.id]);

    const bySearch = await (await send('GET', '/api/disciplines?search=voley')).json();
    expect(bySearch.map((d: { name: string }) => d.name)).toEqual(['Vóley']);

    const cleared = await send('GET', '/api/disciplines?status=');
    expect(await cleared.json()).toHaveLength(2);
  });

  it('rejects an invalid status filter with 400', async () => {
    const { send } = await startApi();
    const response = await send('GET', '/api/disciplines?status=banned');
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('validation_error');
    expect(body.fieldErrors.status).toBeTruthy();
  });

  it('returns 400 with field errors for invalid input', async () => {
    const { send } = await startApi();
    const response = await send('POST', '/api/disciplines', { name: '', teachers: [], leadTeacher: '' });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('validation_error');
    expect(Object.keys(body.fieldErrors).sort()).toEqual(['leadTeacher', 'name', 'teachers']);
  });

  it('rejects a lead teacher that is not among the teachers with 400 on create and update', async () => {
    const { send } = await startApi();
    const invalid = { ...basketball, teachers: ['Ana Gil', 'Lía Soria'], leadTeacher: 'Otra Persona' };
    const created = await send('POST', '/api/disciplines', invalid);
    expect(created.status).toBe(400);
    expect(Object.keys((await created.json()).fieldErrors)).toEqual(['leadTeacher']);

    const valid = await (await send('POST', '/api/disciplines', basketball)).json();
    const updated = await send('PUT', `/api/disciplines/${valid.id}`, invalid);
    expect(updated.status).toBe(400);
  });

  it('creates a discipline with several teachers and returns them with the lead teacher', async () => {
    const { send } = await startApi();
    const response = await send('POST', '/api/disciplines', {
      ...basketball,
      teachers: ['Ana Gil', 'Lía Soria'],
      leadTeacher: 'Lía Soria',
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ teachers: ['Ana Gil', 'Lía Soria'], leadTeacher: 'Lía Soria' });
  });

  it('returns 409 conflict for a duplicate name on create and update', async () => {
    const { send } = await startApi();
    await send('POST', '/api/disciplines', basketball);
    const duplicate = await send('POST', '/api/disciplines', { ...basketball, name: 'básquet' });
    expect(duplicate.status).toBe(409);
    expect((await duplicate.json()).error).toBe('conflict');

    const other = await (await send('POST', '/api/disciplines', volleyball)).json();
    const clash = await send('PUT', `/api/disciplines/${other.id}`, { ...volleyball, name: 'BÁSQUET' });
    expect(clash.status).toBe(409);
  });

  it('updates with PUT', async () => {
    const { send } = await startApi();
    const created = await (await send('POST', '/api/disciplines', basketball)).json();
    const response = await send('PUT', `/api/disciplines/${created.id}`, {
      name: 'Básquet mayor',
      teachers: ['Nuevo Docente', 'Otra Docente'],
      leadTeacher: 'Otra Docente',
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: created.id, name: 'Básquet mayor' });
  });

  it('deactivates and reactivates, with 409 on a repeated transition', async () => {
    const { send } = await startApi();
    const created = await (await send('POST', '/api/disciplines', basketball)).json();

    const inactive = await send('POST', `/api/disciplines/${created.id}/deactivate`);
    expect(inactive.status).toBe(200);
    expect(await inactive.json()).toMatchObject({ status: 'inactive' });
    expect((await send('POST', `/api/disciplines/${created.id}/deactivate`)).status).toBe(409);

    const active = await send('POST', `/api/disciplines/${created.id}/reactivate`);
    expect(await active.json()).toMatchObject({ status: 'active' });
    expect((await send('POST', `/api/disciplines/${created.id}/reactivate`)).status).toBe(409);
  });

  it('returns 404 for unknown ids and offers no delete', async () => {
    const { send } = await startApi();
    for (const [method, path] of [
      ['GET', '/api/disciplines/missing'],
      ['PUT', '/api/disciplines/missing'],
      ['POST', '/api/disciplines/missing/deactivate'],
      ['POST', '/api/disciplines/missing/reactivate'],
    ] as const) {
      const response = await send(method, path, method === 'PUT' ? basketball : undefined);
      expect(response.status, `${method} ${path}`).toBe(404);
      expect((await response.json()).error).toBe('not_found');
    }
    const created = await (await send('POST', '/api/disciplines', basketball)).json();
    expect((await send('DELETE', `/api/disciplines/${created.id}`)).status).toBe(404);
  });
});
