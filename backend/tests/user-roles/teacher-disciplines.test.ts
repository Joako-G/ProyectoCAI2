import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DisciplineIdLookup } from '../../src/modules/users/discipline-lookup.js';
import { createAuthService } from '../../src/modules/auth/auth.service.js';
import { UserRepository } from '../../src/modules/users/user.repository.js';
import { createUserService } from '../../src/modules/users/user.service.js';
import { validUserUpdate } from '../../src/modules/users/user.validation.js';
import { createUsersFile, emailFor, TEST_PASSWORD } from '../authorization/helpers.js';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { while (cleanups.length > 0) await cleanups.pop()!(); });

const known = ['d-basket', 'd-volley'];

async function setup(roles: string[] = ['head_secretary', 'teacher', 'secretary']) {
  const file = await createUsersFile(roles);
  cleanups.push(file.cleanup);
  const repository = new UserRepository(file.storePath);
  const service = createUserService(repository, { disciplineLookup: { findByIds: async (ids) => ids.filter((id) => known.includes(id)).map((id) => ({ id })) } });
  return { repository, service };
}

const base = { name: 'Nuevo Docente', email: 'docente@club.test', password: 'ValidPass123!' };

describe('teacher disciplines on users', () => {
  it('stores and returns the assigned disciplines of a new teacher, without duplicates', async () => {
    const { service, repository } = await setup();
    const result = await service.create({ ...base, role: 'teacher', disciplineIds: ['d-basket', 'd-basket', 'd-volley'] });
    expect(result).toMatchObject({ ok: true, user: { role: 'teacher', disciplineIds: ['d-basket', 'd-volley'] } });
    expect(repository.list().find((user) => user.email === base.email)?.disciplineIds).toEqual(['d-basket', 'd-volley']);
  });

  it('gives a new teacher without the field an empty list, and other roles no field at all', async () => {
    const { service } = await setup();
    expect(await service.create({ ...base, role: 'teacher' })).toMatchObject({ ok: true, user: { disciplineIds: [] } });
    const secretary = await service.create({ ...base, email: 'sec@club.test', role: 'secretary', disciplineIds: ['d-basket'] });
    expect(secretary.ok && 'disciplineIds' in secretary.user).toBe(false);
  });

  it('rejects unknown ids and malformed values', async () => {
    const { service } = await setup();
    for (const disciplineIds of [['missing'], ['d-basket', 'missing'], 'd-basket', [1], [''], null]) {
      expect(await service.create({ ...base, role: 'teacher', disciplineIds })).toEqual({ ok: false, failure: 'invalid' });
    }
    expect(validUserUpdate({ disciplineIds: 'd-basket' })).toBe(false);
    expect(validUserUpdate({ disciplineIds: ['d-basket'] })).toBe(true);
  });

  it('updates the assignment of a teacher and keeps existing teachers without the field valid', async () => {
    const { service, repository } = await setup();
    expect(repository.list().find((user) => user.id === 'user-teacher')?.disciplineIds).toBeUndefined();
    expect(await service.update('user-teacher', { name: 'Docente Renombrado' })).toMatchObject({ ok: true, user: { disciplineIds: [] } });
    expect(await service.update('user-teacher', { disciplineIds: ['d-volley'] })).toMatchObject({ ok: true, user: { disciplineIds: ['d-volley'] } });
    expect(await service.update('user-teacher', { disciplineIds: ['missing'] })).toEqual({ ok: false, failure: 'invalid' });
    expect(await service.update('user-teacher', { name: 'Otro Nombre' })).toMatchObject({ ok: true, user: { disciplineIds: ['d-volley'] } });
  });

  it('clears the assignment when a teacher becomes another role and ignores it for other roles', async () => {
    const { service, repository } = await setup();
    await service.update('user-teacher', { disciplineIds: ['d-basket'] });
    const demoted = await service.update('user-teacher', { role: 'secretary' });
    expect(demoted.ok && 'disciplineIds' in demoted.user).toBe(false);
    expect(repository.list().find((user) => user.id === 'user-teacher')).not.toHaveProperty('disciplineIds');
    const ignored = await service.update('user-secretary', { disciplineIds: ['d-basket'] });
    expect(ignored.ok && 'disciplineIds' in ignored.user).toBe(false);
  });

  it('rejects any assignment when no discipline lookup is available', async () => {
    const file = await createUsersFile(['head_secretary', 'teacher']);
    cleanups.push(file.cleanup);
    const service = createUserService(new UserRepository(file.storePath));
    expect(await service.update('user-teacher', { disciplineIds: ['d-basket'] })).toEqual({ ok: false, failure: 'invalid' });
    expect(await service.update('user-teacher', { disciplineIds: [] })).toMatchObject({ ok: true });
  });

  it('exposes the assignment on the signed-in teacher only', async () => {
    const { service, repository } = await setup();
    await service.update('user-teacher', { disciplineIds: ['d-basket'] });
    const auth = createAuthService(repository);
    expect(auth.login({ email: emailFor('teacher'), password: TEST_PASSWORD })).toMatchObject({ disciplineIds: ['d-basket'] });
    expect(auth.login({ email: emailFor('secretary'), password: TEST_PASSWORD })).not.toHaveProperty('disciplineIds');
  });
});

describe('stored disciplines on update', () => {
  async function withStale(lookup?: DisciplineIdLookup | null) {
    const file = await createUsersFile(['head_secretary', 'teacher', 'secretary']);
    cleanups.push(file.cleanup);
    const repository = new UserRepository(file.storePath);
    repository.replace(repository.list().map((user) =>
      user.id === 'user-teacher' ? { ...user, disciplineIds: ['d-basket', 'removed'] } : user));
    const findByIds = vi.fn(async (ids: readonly string[]) => ids.filter((id) => known.includes(id)).map((id) => ({ id })));
    const disciplineLookup = lookup === null ? undefined : lookup ?? { findByIds };
    return { repository, findByIds, service: createUserService(repository, { disciplineLookup }) };
  }
  const stored = (repository: UserRepository, id = 'user-teacher') => repository.list().find((user) => user.id === id);

  it('keeps the stored ids and never calls the lookup when disciplineIds is not sent', async () => {
    const { service, findByIds, repository } = await withStale();
    expect(await service.update('user-teacher', { name: 'Docente Editado' }))
      .toMatchObject({ ok: true, user: { name: 'Docente Editado', disciplineIds: ['d-basket', 'removed'] } });
    expect(findByIds).not.toHaveBeenCalled();
    expect(stored(repository)?.disciplineIds).toEqual(['d-basket', 'removed']);
  });

  it('keeps the stored ids when no lookup is configured', async () => {
    const { service } = await withStale(null);
    expect(await service.update('user-teacher', { name: 'Sin Lookup' })).toMatchObject({ ok: true, user: { disciplineIds: ['d-basket', 'removed'] } });
    expect(await service.update('user-teacher', { disciplineIds: ['d-basket', 'removed'] })).toMatchObject({ ok: true, user: { disciplineIds: ['d-basket', 'removed'] } });
    expect(await service.update('user-teacher', { disciplineIds: ['d-basket', 'd-volley'] })).toEqual({ ok: false, failure: 'invalid' });
  });

  it('drops only the stale stored id when the full list is sent back', async () => {
    const { service } = await withStale();
    expect(await service.update('user-teacher', { disciplineIds: ['d-basket', 'removed'] })).toMatchObject({ ok: true, user: { disciplineIds: ['d-basket'] } });
  });

  it('still rejects a new unknown id, even next to a stale stored one', async () => {
    const { service } = await withStale();
    expect(await service.update('user-teacher', { disciplineIds: ['d-basket', 'removed', 'never-existed'] })).toEqual({ ok: false, failure: 'invalid' });
  });

  it('clears the ids when a teacher becomes a secretary, and gives a new teacher none or the sent ones', async () => {
    const { service, repository } = await withStale();
    const demoted = await service.update('user-teacher', { role: 'secretary' });
    expect(demoted.ok && 'disciplineIds' in demoted.user).toBe(false);
    expect(stored(repository)).not.toHaveProperty('disciplineIds');
    expect(await service.update('user-teacher', { role: 'teacher' })).toMatchObject({ ok: true, user: { role: 'teacher', disciplineIds: [] } });
    expect(await service.update('user-secretary', { role: 'teacher', disciplineIds: ['d-volley'] })).toMatchObject({ ok: true, user: { disciplineIds: ['d-volley'] } });
  });

  it('does not revert a role change made while the lookup was running', async () => {
    let repository!: UserRepository;
    const lookup: DisciplineIdLookup = {
      findByIds: async (ids) => {
        repository.replace(repository.list().map((user) => user.id === 'user-teacher' ? { ...user, role: 'secretary' } : user));
        return ids.filter((id) => known.includes(id)).map((id) => ({ id }));
      },
    };
    const context = await withStale(lookup);
    repository = context.repository;
    const result = await context.service.update('user-teacher', { disciplineIds: ['d-basket'] });
    expect(result.ok && result.user.role).toBe('secretary');
    expect(result.ok && 'disciplineIds' in result.user).toBe(false);
    expect(stored(repository)?.role).toBe('secretary');
  });
});
