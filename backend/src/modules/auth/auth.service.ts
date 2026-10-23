import { verifyPassword } from '../users/password.js';
import type { UserRepository } from '../users/user.repository.js';
import type { AuthenticatedUser } from './auth.types.js';

export interface AuthService {
  /** Returns the signed-in user, or null for any invalid input, unknown or inactive account, or wrong password. */
  login(input: unknown): AuthenticatedUser | null;
}

export function createAuthService(repository: UserRepository): AuthService {
  return {
    login(input) {
      const { email, password } = (input ?? {}) as Record<string, unknown>;
      if (typeof email !== 'string' || typeof password !== 'string') return null;

      const user = repository.list().find((candidate) => candidate.email.toLowerCase() === email.toLowerCase());
      if (!user || !user.active || !verifyPassword(password, user.passwordHash)) return null;

      const { id, name, role } = user;
      return { id, name, email: user.email, role };
    },
  };
}
