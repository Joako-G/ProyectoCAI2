import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { createAuthService } from '../../src/modules/auth/auth.service.js';
import { UserRepository } from '../../src/modules/users/user.repository.js';
import { createUserService } from '../../src/modules/users/user.service.js';
import { validRole } from '../../src/modules/users/user.validation.js';
import { createUsersFile, emailFor, TEST_PASSWORD } from '../authorization/helpers.js';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { while (cleanups.length > 0) await cleanups.pop()!(); });

async function usersFor(roles: string[]) {
  const file = await createUsersFile(roles);
  cleanups.push(file.cleanup);
  return { ...file, repository: new UserRepository(file.storePath) };
}

describe('user roles', () => {
  it('accepts only the three current roles', () => {
    for (const role of ['secretary', 'head_secretary', 'teacher']) expect(validRole(role)).toBe(true);
    for (const role of ['admin', 'member', 'owner', '', undefined, 1]) expect(validRole(role)).toBe(false);
  });

  it('maps legacy stored roles when users are read', async () => {
    const { repository } = await usersFor(['admin', 'member', 'teacher']);
    expect(repository.list().map((user) => user.role)).toEqual(['head_secretary', 'secretary', 'teacher']);
  });

  it('lets a legacy admin log in as head_secretary', async () => {
    const { repository } = await usersFor(['admin']);
    const user = createAuthService(repository).login({ email: emailFor('admin'), password: TEST_PASSWORD });
    expect(user?.role).toBe('head_secretary');
  });

  it('rejects legacy roles on create and update', async () => {
    const { repository } = await usersFor(['head_secretary']);
    const service = createUserService(repository);
    const base = { name: 'Some Name', email: 'new@club.test', password: 'ValidPass123!' };
    for (const role of ['admin', 'member']) expect(service.create({ ...base, role })).toEqual({ ok: false, failure: 'invalid' });
    expect(service.update('user-head_secretary', { role: 'admin' })).toEqual({ ok: false, failure: 'invalid' });
    expect(service.create({ ...base, role: 'teacher' }).ok).toBe(true);
  });

  it('persists the migrated role names on the next save', async () => {
    const { repository, storePath } = await usersFor(['admin']);
    expect(createUserService(repository).update('user-admin', { name: 'Renamed Admin' }).ok).toBe(true);
    expect(JSON.parse(await readFile(storePath, 'utf8'))[0].role).toBe('head_secretary');
  });
});
