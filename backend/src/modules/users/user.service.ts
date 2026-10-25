import { randomUUID } from 'node:crypto';
import { hashPassword } from './password.js';
import type { UserRepository } from './user.repository.js';
import type { DemoUser, SafeUser, UserResult } from './user.types.js';
import { validEmail, validName, validPassword, validRole, validUserUpdate } from './user.validation.js';

export interface UserService {
  list(): SafeUser[];
  create(input: unknown): UserResult;
  update(id: string, input: unknown): UserResult;
  deactivate(id: string): UserResult;
}

export function hasActiveHeadSecretary(users: readonly DemoUser[]): boolean {
  return users.some((user) => user.active && user.role === 'head_secretary');
}

export function toSafeUser({ id, name, email, role, active }: DemoUser): SafeUser { return { id, name, email, role, active }; }

export function createUserService(repository: UserRepository): UserService {
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

    create(input) {
      const { name, email, role, password } = (input ?? {}) as Record<string, unknown>;
      if (!validName(name) || !validEmail(email) || !validRole(role) || !validPassword(password)) return { ok: false, failure: 'invalid' };
      if (emailTaken(email)) return { ok: false, failure: 'duplicate-email' };
      const user: DemoUser = { id: randomUUID(), name: name.trim(), email: email.trim(), role, passwordHash: hashPassword(password), active: true };
      return commit([...repository.list(), user], user);
    },

    update(id, input) {
      const user = repository.list().find((candidate) => candidate.id === id);
      if (!user) return { ok: false, failure: 'not-found' };
      const body = (input ?? {}) as Record<string, unknown>;
      if (!validUserUpdate(body)) return { ok: false, failure: 'invalid' };
      if (typeof body.email === 'string' && emailTaken(body.email, user.id)) return { ok: false, failure: 'duplicate-email' };
      const updated = { ...user };
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
