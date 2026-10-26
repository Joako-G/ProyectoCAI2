import { verifyPassword } from '../users/password.js';
import type { UserRepository } from '../users/user.repository.js';
import { disciplinesOf } from '../users/user.service.js';
import type { DemoUser } from '../users/user.types.js';
import type { AuthenticatedUser } from './auth.types.js';

export interface AuthService {
  /** Returns the signed-in user, or null for any invalid input, unknown or inactive account, or wrong password. */
  login(input: unknown): AuthenticatedUser | null;
  /** Returns the account for a session's user id, or null when it no longer exists or is inactive. */
  getActiveUser(id: string): AuthenticatedUser | null;
}

function toAuthenticatedUser(user: DemoUser): AuthenticatedUser {
  const { id, name, email, role } = user;
  return { id, name, email, role, ...disciplinesOf(user) };
}

export function createAuthService(repository: UserRepository): AuthService {
  return {
    login(input) {
      const { email, password } = (input ?? {}) as Record<string, unknown>;
      if (typeof email !== 'string' || typeof password !== 'string') return null;

      const user = repository.list().find((candidate) => candidate.email.toLowerCase() === email.toLowerCase());
      if (!user || !user.active || !verifyPassword(password, user.passwordHash)) return null;

      return toAuthenticatedUser(user);
    },
    getActiveUser(id) {
      const user = repository.list().find((candidate) => candidate.id === id);
      return user?.active ? toAuthenticatedUser(user) : null;
    },
  };
}
