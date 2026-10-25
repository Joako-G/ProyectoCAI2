import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { createTestContext as createDisciplines } from '../disciplines/helpers.js';
import { createTestContext as createMembers } from '../members/helpers.js';
import { createTestContext as createMemberships } from '../memberships/helpers.js';
import { createUsersFile, signIn } from './helpers.js';

type RoleName = 'head_secretary' | 'secretary' | 'teacher';
const roles: RoleName[] = ['head_secretary', 'secretary', 'teacher'];

const both: RoleName[] = ['head_secretary', 'secretary'];
const headOnly: RoleName[] = ['head_secretary'];

// [method, path, roles allowed past the authorization layer]
const routes: Array<[string, string, RoleName[]]> = [
  ['GET', '/users', headOnly],
  ['POST', '/users', headOnly],
  ['PATCH', '/users/missing', headOnly],
  ['DELETE', '/users/missing', headOnly],
  ['GET', '/api/members', both],
  ['GET', '/api/members/missing', both],
  ['POST', '/api/members', both],
  ['PUT', '/api/members/missing', both],
  ['POST', '/api/members/missing/deactivate', both],
  ['POST', '/api/members/missing/reactivate', both],
  ['GET', '/api/disciplines', both],
  ['GET', '/api/disciplines/missing', both],
  ['POST', '/api/disciplines', headOnly],
  ['PUT', '/api/disciplines/missing', headOnly],
  ['POST', '/api/disciplines/missing/deactivate', headOnly],
  ['POST', '/api/disciplines/missing/reactivate', headOnly],
  ['GET', '/api/memberships', both],
  ['GET', '/api/memberships/missing', both],
];

let baseUrl: string;
let server: Server;
const cookies = {} as Record<RoleName, string>;
const cleanups: Array<() => Promise<void>> = [];

beforeAll(async () => {
  const users = await createUsersFile();
  const members = await createMembers();
  const disciplines = await createDisciplines();
  const memberships = await createMemberships();
  cleanups.push(users.cleanup, members.cleanup, disciplines.cleanup, memberships.cleanup);
  server = createApp({
    storePath: users.storePath,
    memberService: members.service,
    disciplineService: disciplines.service,
    membershipService: memberships.service,
  }).listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  for (const role of roles) cookies[role] = await signIn(baseUrl, role);
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const cleanup of cleanups) await cleanup();
});

function call(method: string, path: string, cookie?: string) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: method === 'GET' || method === 'DELETE' ? undefined : '{}',
  });
}

describe('route authorization matrix', () => {
  it.each(routes)('%s %s answers 401 without a session', async (method, path) => {
    const response = await call(method, path);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Authentication required' });
  });

  for (const role of roles) {
    it.each(routes)(`${role}: %s %s`, async (method, path, allowed) => {
      const response = await call(method, path, cookies[role]);
      if (allowed.includes(role)) {
        expect([401, 403]).not.toContain(response.status);
      } else {
        expect(response.status).toBe(403);
        expect(await response.json()).toEqual({ error: 'Forbidden' });
      }
    });
  }

  it('keeps /health and /auth public', async () => {
    expect((await call('GET', '/health')).status).toBe(200);
    expect((await call('GET', '/auth/me')).status).toBe(401);
    expect((await call('GET', '/auth/me', cookies.teacher)).status).toBe(200);
  });
});
