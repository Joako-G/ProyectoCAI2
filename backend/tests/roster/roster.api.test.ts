import { readFile, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { createRosterService } from '../../src/modules/roster/roster.service.js';
import { createUsersFile, signIn } from '../authorization/helpers.js';
import { createTestContext as createDisciplines } from '../disciplines/helpers.js';
import { adultInput, createTestContext as createMembers } from '../members/helpers.js';
import { createTestContext as createMemberships } from '../memberships/helpers.js';

let server: Server;
let baseUrl: string;
const cleanups: Array<() => Promise<void>> = [];

beforeAll(async () => {
  const users = await createUsersFile();
  const members = await createMembers();
  const disciplines = await createDisciplines();
  const memberships = await createMemberships();
  cleanups.push(users.cleanup, members.cleanup, disciplines.cleanup, memberships.cleanup);
  const mine = await disciplines.service.create({ name: 'Básquet', teachers: ['T'], leadTeacher: 'T' });
  const theirs = await disciplines.service.create({ name: 'Vóley', teachers: ['U'], leadTeacher: 'U' });
  // The members fake knows other discipline ids; the memberships history is what the roster reads.
  const member = await members.service.create(adultInput);
  await memberships.service.syncMember(member.id, [mine.id], '2026-02-01');
  await memberships.service.syncMember(member.id, [theirs.id], '2026-03-01');
  // The teacher account is assigned only the first discipline (and one that no longer exists).
  const stored = JSON.parse(await readFile(users.storePath, 'utf8')) as Array<Record<string, unknown>>;
  for (const user of stored) if (user.role === 'teacher') user.disciplineIds = [mine.id, 'removed'];
  await writeFile(users.storePath, JSON.stringify(stored));
  server = createApp({
    storePath: users.storePath,
    rosterService: createRosterService({ memberships: memberships.service, members: members.service, disciplines: disciplines.service }),
  }).listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const cleanup of cleanups) await cleanup();
});

describe('GET /api/roster', () => {
  it('answers 401 without a session and 403 to the secretary and the head secretary', async () => {
    expect((await fetch(`${baseUrl}/api/roster`)).status).toBe(401);
    for (const role of ['secretary', 'head_secretary'] as const) {
      const response = await fetch(`${baseUrl}/api/roster`, { headers: { cookie: await signIn(baseUrl, role) } });
      expect(response.status).toBe(403);
    }
  });

  it("returns only the signed-in teacher's own disciplines, ignoring any query parameter", async () => {
    const cookie = await signIn(baseUrl, 'teacher');
    const response = await fetch(`${baseUrl}/api/roster?disciplineIds=other`, { headers: { cookie } });
    expect(response.status).toBe(200);
    const roster = await response.json() as Array<{ discipline: { name: string }; students: unknown[] }>;
    expect(roster).toHaveLength(1);
    expect(roster[0]!.discipline.name).toBe('Básquet');
    expect(roster[0]!.students).toEqual([expect.objectContaining({ fullName: 'Lucía Ríos', status: 'ended', endDate: '2026-03-01' })]);
  });
});
