import { randomUUID } from 'node:crypto';
import { hashPassword } from './password.js';
import type { DisciplineIdLookup } from './discipline-lookup.js';
import type { UserRepository } from './user.repository.js';
import type { DemoUser, SafeUser, UserResult } from './user.types.js';
import { validDisciplineIds, validEmail, validName, validPassword, validRole, validUserUpdate } from './user.validation.js';

export interface UserService {
  list(): SafeUser[];
  create(input: unknown): Promise<UserResult>;
  update(id: string, input: unknown): Promise<UserResult>;
  deactivate(id: string): UserResult;
}

export function hasActiveHeadSecretary(users: readonly DemoUser[]): boolean {
  return users.some((user) => user.active && user.role === 'head_secretary');
}

/** Only teachers carry disciplines; a teacher without the stored field has none. */
export function disciplinesOf({ role, disciplineIds }: DemoUser): { disciplineIds?: string[] } {
  return role === 'teacher' ? { disciplineIds: disciplineIds ?? [] } : {};
}

export function toSafeUser(user: DemoUser): SafeUser {
  const { id, name, email, role, active } = user;
  return { id, name, email, role, active, ...disciplinesOf(user) };
}

export interface UserServiceOptions {
  // Checks that assigned disciplines exist; without it no discipline can be assigned.
  disciplineLookup?: DisciplineIdLookup;
}

export function createUserService(repository: UserRepository, { disciplineLookup }: UserServiceOptions = {}): UserService {
  // The deduplicated ids when every one exists, otherwise null.
  async function existingDisciplineIds(ids: string[]): Promise<string[] | null> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return unique;
    const found = new Set((await disciplineLookup?.findByIds(unique) ?? []).map(({ id }) => id));
    return unique.every((id) => found.has(id)) ? unique : null;
  }

  function emailTaken(email: string, exceptId?: string): boolean {
    const normalized = email.trim().toLowerCase();
    return repository.list().some((candidate) => candidate.id !== exceptId && candidate.email.toLowerCase() === normalized);
  }

  // Persists the whole list first, so a failed save leaves the in-memory users unchanged.
  function commit(users: DemoUser[], user: DemoUser): UserResult {
    try { repository.replace(users); } catch { return { ok: false, failure: 'save-failed' }; }
    return { ok: true, user: toSafeUser(user) };
  }

  // Rejects a change that would leave nobody able to manage users (only when someone could before it).
  function replaceUser(updated: DemoUser): UserResult {
    const current = repository.list();
    const next = current.map((candidate) => candidate.id === updated.id ? updated : candidate);
    if (hasActiveHeadSecretary(current) && !hasActiveHeadSecretary(next)) return { ok: false, failure: 'last-head-secretary' };
    return commit(next, updated);
  }

  return {
    list: () => repository.list().map(toSafeUser),

    async create(input) {
      const { name, email, role, password, disciplineIds } = (input ?? {}) as Record<string, unknown>;
      if (!validName(name) || !validEmail(email) || !validRole(role) || !validPassword(password)) return { ok: false, failure: 'invalid' };
      if (disciplineIds !== undefined && !validDisciplineIds(disciplineIds)) return { ok: false, failure: 'invalid' };
      const assigned = role === 'teacher' && disciplineIds ? await existingDisciplineIds(disciplineIds) : [];
      if (!assigned) return { ok: false, failure: 'invalid' };
      if (emailTaken(email)) return { ok: false, failure: 'duplicate-email' };
      const user: DemoUser = { id: randomUUID(), name: name.trim(), email: email.trim(), role, passwordHash: hashPassword(password), active: true, ...(role === 'teacher' ? { disciplineIds: assigned } : {}) };
      return commit([...repository.list(), user], user);
    },

    async update(id, input) {
      if (!repository.list().some((candidate) => candidate.id === id)) return { ok: false, failure: 'not-found' };
      const body = (input ?? {}) as Record<string, unknown>;
      if (!validUserUpdate(body)) return { ok: false, failure: 'invalid' };
      // Looked up before re-reading the user, so nothing changes between the last read and the write.
      const assigned = validDisciplineIds(body.disciplineIds) ? await existingDisciplineIds(body.disciplineIds) : undefined;
      const user = repository.list().find((candidate) => candidate.id === id);
      if (!user) return { ok: false, failure: 'not-found' };
      const role = validRole(body.role) ? body.role : user.role;
      if (role === 'teacher' && assigned === null) return { ok: false, failure: 'invalid' };
      if (typeof body.email === 'string' && emailTaken(body.email, user.id)) return { ok: false, failure: 'duplicate-email' };
      const { disciplineIds: _previous, ...rest } = user;
      const updated: DemoUser = { ...rest, ...(role === 'teacher' ? { disciplineIds: assigned ?? user.disciplineIds ?? [] } : {}) };
      if (typeof body.name === 'string') updated.name = body.name.trim();
      if (typeof body.email === 'string') updated.email = body.email.trim();
      if (validRole(body.role)) updated.role = body.role;
      if (typeof body.active === 'boolean') updated.active = body.active;
      if (typeof body.password === 'string') updated.passwordHash = hashPassword(body.password);
      return replaceUser(updated);
    },

    deactivate(id) {
      const user = repository.list().find((candidate) => candidate.id === id);
      if (!user) return { ok: false, failure: 'not-found' };
      return replaceUser({ ...user, active: false });
    },
  };
}
