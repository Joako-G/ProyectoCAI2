import { randomBytes } from 'node:crypto';
import type { Request } from 'express';
import type { AuthService } from './auth.service.js';
import type { AuthenticatedUser } from './auth.types.js';

export const SESSION_COOKIE = 'club_session';

/** In-memory sessions: they are lost when the server restarts. */
export interface SessionStore {
  create(userId: string): string;
  get(token: string): string | undefined;
  destroy(token: string): void;
}

export function createSessionStore(): SessionStore {
  const sessions = new Map<string, string>();
  return {
    create(userId) {
      const token = randomBytes(32).toString('hex');
      sessions.set(token, userId);
      return token;
    },
    get: (token) => sessions.get(token),
    destroy(token) { sessions.delete(token); },
  };
}

export function readSessionToken(request: Request): string | undefined {
  for (const pair of (request.headers.cookie ?? '').split(';')) {
    const separator = pair.indexOf('=');
    if (separator > 0 && pair.slice(0, separator).trim() === SESSION_COOKIE) return pair.slice(separator + 1).trim();
  }
  return undefined;
}

export type Authenticator = (request: Request) => AuthenticatedUser | null;

/** Resolves the signed-in user from the session cookie; deactivated accounts lose access immediately. */
export function createAuthenticator(sessions: SessionStore, service: AuthService): Authenticator {
  return (request) => {
    const token = readSessionToken(request);
    const userId = token ? sessions.get(token) : undefined;
    return userId ? service.getActiveUser(userId) : null;
  };
}
