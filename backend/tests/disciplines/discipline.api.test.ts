import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import type { MemberRepository } from '../../src/modules/members/member.repository.js';
import { createMemberService } from '../../src/modules/members/member.service.js';
import { createUsersFile, signIn } from '../authorization/helpers.js';
import { listenOnFetchSafePort } from '../helpers/listen.mjs';
import { basketball, createTestContext } from './helpers.js';
import { noAudit } from '../audit/helpers.js';

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
  const users = await createUsersFile();
  cleanups.push(users.cleanup);
  const app = createApp({
    storePath: users.storePath,
    memberService: createMemberService({ audit: noAudit, repository: memberRepository, disciplineLookup: context.service }),
    disciplineService: context.service,
  });
  const server: Server = await listenOnFetchSafePort(app);
  cleanups.push(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const cookie = await signIn(baseUrl, 'head_secretary');
  const send = (method: string, path: string, body?: unknown) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'content-type': 'application/json', cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  return { send, ...context };
}

const TEACHER = 'user-teacher';
// What the screen sends: the name and the teacher accounts, one of them in charge.
const staffed = (name: string, teacherIds: string[] = [TEACHER], leadTeacherId: string = teacherIds[0]!) => ({ name, teacherIds, leadTeacherId });
const BASKETBALL = staffed('Básquet');
const VOLLEYBALL = staffed('Vóley');

type Send = Awaited<ReturnType<typeof startApi>>['send'];

async function addTeacher(send: Send, name: string): Promise<string> {
  const response = await send('POST', '/users', { name, email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@club.test`, role: 'teacher', password: 'Passw0rd-Long-1' });
  expect(response.status).toBe(201);
  return (await response.json()).id;
}

async function disciplinesOf(send: Send, userId: string): Promise<string[]> {
  const users: Array<{ id: string; disciplineIds?: string[] }> = await (await send('GET', '/users')).json();
  return users.find((user) => user.id === userId)!.disciplineIds ?? [];
}

describe('disciplines API', () => {
  it('creates a discipline with 201, staffed by teacher accounts, and reads it back', async () => {
    const { send } = await startApi();
    const created = await send('POST', '/api/disciplines', BASKETBALL);
    expect(created.status).toBe(201);
    const discipline = await created.json();
    expect(discipline).toMatchObject({
      name: 'Básquet',
      teachers: ['Test teacher'],
      leadTeacher: 'Test teacher',
      teacherIds: [TEACHER],
      leadTeacherId: TEACHER,
      status: 'active',
    });
    expect(await disciplinesOf(send, TEACHER)).toEqual([discipline.id]);

    const fetched = await send('GET', `/api/disciplines/${discipline.id}`);
    expect(fetched.status).toBe(200);
    expect(await fetched.json()).toEqual(discipline);
  });

  it('lists the active teacher accounts a discipline can be given to', async () => {
    const { send } = await startApi();
    const lia = await addTeacher(send, 'Lía Soria');
    const gone = await addTeacher(send, 'Ana Gil');
    await send('DELETE', `/users/${gone}`);

    const response = await send('GET', '/api/disciplines/teachers');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ id: lia, name: 'Lía Soria' }, { id: TEACHER, name: 'Test teacher' }]);
  });

  it('lists disciplines filtered by search and status', async () => {
    const { send } = await startApi();
    await send('POST', '/api/disciplines', VOLLEYBALL);
    const basket = await (await send('POST', '/api/disciplines', BASKETBALL)).json();
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
    const response = await send('POST', '/api/disciplines', { name: '', teacherIds: [], leadTeacherId: '' });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('validation_error');
    expect(Object.keys(body.fieldErrors).sort()).toEqual(['leadTeacher', 'name', 'teachers']);
  });

  it('rejects typed names: a teacher must be an active teacher account', async () => {
    const { send, service } = await startApi();
    for (const body of [
      { name: 'Básquet', teachers: ['Marcos Ledesma'], leadTeacher: 'Marcos Ledesma' },
      staffed('Básquet', ['user-secretary']),
      staffed('Básquet', ['nobody']),
    ]) {
      const response = await send('POST', '/api/disciplines', body);
      expect(response.status, JSON.stringify(body)).toBe(400);
      expect((await response.json()).fieldErrors.teachers, JSON.stringify(body)).toBeTruthy();
    }
    const gone = await addTeacher(send, 'Ana Gil');
    await send('DELETE', `/users/${gone}`);
    expect((await send('POST', '/api/disciplines', staffed('Básquet', [gone]))).status).toBe(400);
    expect(await service.list()).toEqual([]);
  });

  it('rejects a lead teacher that is not among the teachers with 400 on create and update', async () => {
    const { send } = await startApi();
    const lia = await addTeacher(send, 'Lía Soria');
    const invalid = staffed('Básquet', [TEACHER], lia);
    const created = await send('POST', '/api/disciplines', invalid);
    expect(created.status).toBe(400);
    expect(Object.keys((await created.json()).fieldErrors)).toEqual(['leadTeacher']);

    const valid = await (await send('POST', '/api/disciplines', BASKETBALL)).json();
    const updated = await send('PUT', `/api/disciplines/${valid.id}`, invalid);
    expect(updated.status).toBe(400);
    expect(await disciplinesOf(send, lia)).toEqual([]);
  });

  it('creates a discipline with several teachers and returns them with the lead teacher', async () => {
    const { send } = await startApi();
    const lia = await addTeacher(send, 'Lía Soria');
    const response = await send('POST', '/api/disciplines', staffed('Básquet', [TEACHER, lia], lia));
    expect(response.status).toBe(201);
    const discipline = await response.json();
    expect(discipline).toMatchObject({ teachers: ['Lía Soria', 'Test teacher'], leadTeacher: 'Lía Soria', teacherIds: [lia, TEACHER], leadTeacherId: lia });
    expect(await disciplinesOf(send, lia)).toEqual([discipline.id]);
    expect(await disciplinesOf(send, TEACHER)).toEqual([discipline.id]);
  });

  it('moves the discipline between accounts on update and leaves their other disciplines alone', async () => {
    const { send } = await startApi();
    const lia = await addTeacher(send, 'Lía Soria');
    const volley = await (await send('POST', '/api/disciplines', VOLLEYBALL)).json();
    const basket = await (await send('POST', '/api/disciplines', BASKETBALL)).json();

    const response = await send('PUT', `/api/disciplines/${basket.id}`, staffed('Básquet mayor', [lia]));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: basket.id, name: 'Básquet mayor', teachers: ['Lía Soria'], leadTeacher: 'Lía Soria', teacherIds: [lia] });
    expect(await disciplinesOf(send, lia)).toEqual([basket.id]);
    expect(await disciplinesOf(send, TEACHER)).toEqual([volley.id]);
  });

  it('follows the accounts: a renamed teacher shows the new name and an unassigned one leaves the discipline', async () => {
    const { send } = await startApi();
    const lia = await addTeacher(send, 'Lía Soria');
    const created = await (await send('POST', '/api/disciplines', staffed('Básquet', [TEACHER, lia], lia))).json();

    await send('PATCH', `/users/${TEACHER}`, { name: 'Marcos Ledesma' });
    await send('PATCH', `/users/${lia}`, { disciplineIds: [] });
    // The one in charge left, so the remaining teacher takes over.
    expect(await (await send('GET', `/api/disciplines/${created.id}`)).json()).toMatchObject({ teachers: ['Marcos Ledesma'], leadTeacher: 'Marcos Ledesma', teacherIds: [TEACHER], leadTeacherId: TEACHER });

    await send('PATCH', `/users/${TEACHER}`, { disciplineIds: [] });
    expect(await (await send('GET', `/api/disciplines/${created.id}`)).json()).toMatchObject({ teachers: [], leadTeacher: '', teacherIds: [], leadTeacherId: null });
  });

  it('shows the typed names of a discipline saved before teachers were accounts, until it is edited', async () => {
    const { send, service } = await startApi();
    const legacy = await service.create(basketball, 'user-test');

    expect(await (await send('GET', `/api/disciplines/${legacy.id}`)).json()).toMatchObject({ teachers: ['Marcos Ledesma'], leadTeacher: 'Marcos Ledesma', teacherIds: [], leadTeacherId: null });

    const edited = await send('PUT', `/api/disciplines/${legacy.id}`, BASKETBALL);
    expect(await edited.json()).toMatchObject({ teachers: ['Test teacher'], leadTeacher: 'Test teacher', teacherIds: [TEACHER], leadTeacherId: TEACHER });
  });

  it('returns 409 conflict for a duplicate name on create and update', async () => {
    const { send } = await startApi();
    await send('POST', '/api/disciplines', BASKETBALL);
    const duplicate = await send('POST', '/api/disciplines', staffed('básquet'));
    expect(duplicate.status).toBe(409);
    expect((await duplicate.json()).error).toBe('conflict');

    const other = await (await send('POST', '/api/disciplines', VOLLEYBALL)).json();
    const clash = await send('PUT', `/api/disciplines/${other.id}`, staffed('BÁSQUET'));
    expect(clash.status).toBe(409);
  });

  it('deactivates and reactivates, with 409 on a repeated transition', async () => {
    const { send } = await startApi();
    const created = await (await send('POST', '/api/disciplines', BASKETBALL)).json();

    const inactive = await send('POST', `/api/disciplines/${created.id}/deactivate`);
    expect(inactive.status).toBe(200);
    expect(await inactive.json()).toMatchObject({ status: 'inactive', teachers: ['Test teacher'] });
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
      const response = await send(method, path, method === 'PUT' ? BASKETBALL : undefined);
      expect(response.status, `${method} ${path}`).toBe(404);
      expect((await response.json()).error).toBe('not_found');
    }
    const created = await (await send('POST', '/api/disciplines', BASKETBALL)).json();
    expect((await send('DELETE', `/api/disciplines/${created.id}`)).status).toBe(404);
  });
});
