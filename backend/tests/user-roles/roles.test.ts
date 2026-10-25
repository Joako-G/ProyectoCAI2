import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
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

  it('does not resolve stored roles through the object prototype', async () => {
    const { repository } = await usersFor(['constructor', 'toString', '__proto__', 'hasOwnProperty']);
    expect(repository.list().map((user) => user.role)).toEqual(['constructor', 'toString', '__proto__', 'hasOwnProperty']);
  });
});

describe('last head secretary guard', () => {
  it('rejects demoting the last head secretary, including self-demotion, and leaves the store unchanged', async () => {
    const { repository, storePath } = await usersFor(['head_secretary', 'secretary']);
    const before = await readFile(storePath, 'utf8');
    const service = createUserService(repository);
    expect(service.update('user-head_secretary', { role: 'secretary' })).toEqual({ ok: false, failure: 'last-head-secretary' });
    expect(service.update('user-head_secretary', { role: 'teacher', name: 'Other Name' })).toEqual({ ok: false, failure: 'last-head-secretary' });
    expect(await readFile(storePath, 'utf8')).toBe(before);
    expect(repository.list().find((user) => user.id === 'user-head_secretary')?.role).toBe('head_secretary');
  });

  it('rejects deactivating the last head secretary, by update or by delete', async () => {
    const { repository } = await usersFor(['head_secretary', 'secretary']);
    const service = createUserService(repository);
    expect(service.update('user-head_secretary', { active: false })).toEqual({ ok: false, failure: 'last-head-secretary' });
    expect(service.deactivate('user-head_secretary')).toEqual({ ok: false, failure: 'last-head-secretary' });
  });

  it('allows the change while another active head secretary remains, and other edits on the last one', async () => {
    const { repository } = await usersFor(['head_secretary', 'secretary']);
    const service = createUserService(repository);
    expect(service.update('user-head_secretary', { name: 'Renamed Head' }).ok).toBe(true);
    expect(service.create({ name: 'Second Head', email: 'second@club.test', role: 'head_secretary', password: 'ValidPass123!' }).ok).toBe(true);
    expect(service.update('user-head_secretary', { role: 'secretary' }).ok).toBe(true);
    expect(service.deactivate('user-secretary').ok).toBe(true);
  });

  it('still counts only active heads: an inactive head does not protect the last active one', async () => {
    const { repository } = await usersFor(['head_secretary', 'head_secretary']);
    // Both fixtures share the role name, so ids collide; rebuild distinct accounts.
    const [first, second] = repository.list();
    repository.replace([{ ...first!, id: 'a' }, { ...second!, id: 'b', email: 'b@club.test', active: false }]);
    expect(createUserService(repository).deactivate('a')).toEqual({ ok: false, failure: 'last-head-secretary' });
  });
});

describe('startup without an active head secretary', () => {
  it('warns clearly, changes no accounts and promotes nobody', async () => {
    const { storePath } = await usersFor(['secretary', 'teacher']);
    const before = await readFile(storePath, 'utf8');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    createApp({ storePath });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no active head_secretary'));
    warn.mockRestore();
    expect(await readFile(storePath, 'utf8')).toBe(before);
  });

  it('stays silent when an active head secretary exists', async () => {
    const { storePath } = await usersFor(['head_secretary']);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    createApp({ storePath });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
