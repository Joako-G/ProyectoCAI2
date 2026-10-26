import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { createUsersFile, signIn } from '../authorization/helpers.js';
import { createTestContext as createDisciplines } from '../disciplines/helpers.js';

let server: Server;
let baseUrl: string;
let cookie: string;
let disciplineId: string;
const cleanups: Array<() => Promise<void>> = [];

beforeAll(async () => {
  const users = await createUsersFile();
  const disciplines = await createDisciplines();
  cleanups.push(users.cleanup, disciplines.cleanup);
  disciplineId = (await disciplines.service.create({ name: 'Básquet', teachers: ['T'], leadTeacher: 'T' })).id;
  server = createApp({ storePath: users.storePath, disciplineService: disciplines.service }).listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  cookie = await signIn(baseUrl, 'head_secretary');
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const cleanup of cleanups) await cleanup();
});

const send = (method: string, path: string, body: unknown) => fetch(`${baseUrl}${path}`, {
  method, headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(body),
});

describe('/users with the real app wiring', () => {
  it('stores disciplineIds on create and update, and rejects unknown ones', async () => {
    const created = await send('POST', '/users', { name: 'Docente Http', email: 'http@club.test', role: 'teacher', password: 'ValidPass123!', disciplineIds: [disciplineId] });
    expect(created.status).toBe(201);
    const user = await created.json() as { id: string; disciplineIds: string[] };
    expect(user.disciplineIds).toEqual([disciplineId]);

    expect((await send('PATCH', `/users/${user.id}`, { disciplineIds: ['missing'] })).status).toBe(400);
    const cleared = await send('PATCH', `/users/${user.id}`, { disciplineIds: [] });
    expect(await cleared.json()).toMatchObject({ disciplineIds: [] });
    const listed = await (await fetch(`${baseUrl}/users`, { headers: { cookie } })).json() as Array<{ id: string; disciplineIds?: string[] }>;
    expect(listed.find((entry) => entry.id === user.id)?.disciplineIds).toEqual([]);
  });
});
