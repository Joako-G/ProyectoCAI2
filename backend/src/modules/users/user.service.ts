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
  type Assignment = { kind: 'not-teacher' } | { kind: 'invalid' } | { kind: 'valid'; ids: string[] };
  type Existence = { kind: 'unknown' } | { kind: 'known'; ids: Set<string> };

  // Which of the ids exist. Without a lookup that is unknown, which is not the same as "none exist".
  async function resolveExisting(ids: readonly string[]): Promise<Existence> {
    if (!disciplineLookup) return { kind: 'unknown' };
    if (ids.length === 0) return { kind: 'known', ids: new Set() };
    return { kind: 'known', ids: new Set((await disciplineLookup.findByIds(ids)).map(({ id }) => id)) };
  }

  // A teacher's disciplines after "sent" (absent keeps "stored"). Stored ids that no longer exist are dropped
  // silently when the list is sent back; a new id that does not exist is invalid. When existence is unknown,
  // stored ids are kept and any new id is invalid.
  function assignDisciplines(sent: readonly string[] | undefined, stored: readonly string[], existence: Existence): Assignment {
    if (!sent) return { kind: 'valid', ids: [...stored] };
    const ids = [...new Set(sent)];
    const exists = (id: string) => existence.kind === 'known' && existence.ids.has(id);
    if (ids.some((id) => !exists(id) && !stored.includes(id))) return { kind: 'invalid' };
    return { kind: 'valid', ids: existence.kind === 'known' ? ids.filter(exists) : ids };
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
      const assignment = role === 'teacher' ? assignDisciplines(disciplineIds ?? [], [], await resolveExisting(disciplineIds ?? [])) : { kind: 'not-teacher' as const };
      if (assignment.kind === 'invalid') return { ok: false, failure: 'invalid' };
      if (emailTaken(email)) return { ok: false, failure: 'duplicate-email' };
      const user: DemoUser = { id: randomUUID(), name: name.trim(), email: email.trim(), role, passwordHash: hashPassword(password), active: true, ...(assignment.kind === 'valid' ? { disciplineIds: assignment.ids } : {}) };
      return commit([...repository.list(), user], user);
    },

    async update(id, input) {
      if (!repository.list().some((candidate) => candidate.id === id)) return { ok: false, failure: 'not-found' };
      const body = (input ?? {}) as Record<string, unknown>;
      if (!validUserUpdate(body)) return { ok: false, failure: 'invalid' };
      // The lookup runs first, and only when ids are sent for a user who may stay a teacher; everything after it
      // is one synchronous read and write.
      const sent = validDisciplineIds(body.disciplineIds) ? body.disciplineIds : undefined;
      const becomesNonTeacher = validRole(body.role) && body.role !== 'teacher';
      const existence: Existence = sent && !becomesNonTeacher ? await resolveExisting(sent) : { kind: 'unknown' };
      const user = repository.list().find((candidate) => candidate.id === id);
      if (!user) return { ok: false, failure: 'not-found' };
      const role = validRole(body.role) ? body.role : user.role;
      const assignment = role === 'teacher' ? assignDisciplines(sent, user.disciplineIds ?? [], existence) : { kind: 'not-teacher' as const };
      if (assignment.kind === 'invalid') return { ok: false, failure: 'invalid' };
      if (typeof body.email === 'string' && emailTaken(body.email, user.id)) return { ok: false, failure: 'duplicate-email' };
      const { disciplineIds: _previous, ...rest } = user;
      // `role` comes from this same read, so writing it never reverts a concurrent role change.
      const updated: DemoUser = { ...rest, role, ...(assignment.kind === 'valid' ? { disciplineIds: assignment.ids } : {}) };
      if (typeof body.name === 'string') updated.name = body.name.trim();
      if (typeof body.email === 'string') updated.email = body.email.trim();
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
