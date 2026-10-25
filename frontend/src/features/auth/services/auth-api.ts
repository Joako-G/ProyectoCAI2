import type { AuthUser, Capability } from '../types/auth';

interface SessionPayload {
  user?: Omit<AuthUser, 'capabilities'>;
  capabilities?: Capability[];
}

// The server sends the capabilities next to the user; a missing list means the user can do nothing.
function toAuthUser({ user, capabilities }: SessionPayload): AuthUser | null {
  return user ? { ...user, capabilities: capabilities ?? [] } : null;
}

// The session lives in an httpOnly cookie, so every auth request must send credentials.
export async function login(email: string, password: string): Promise<AuthUser> {
  const response = await fetch('/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(`Login failed with status ${response.status}`);
  const user = toAuthUser(await response.json() as SessionPayload);
  if (!user) throw new Error('Login response had no user');
  return user;
}

/** Returns the user of the current server session, or null when there is none. */
export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const response = await fetch('/auth/me', { credentials: 'include' });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`Session check failed with status ${response.status}`);
  return toAuthUser(await response.json() as SessionPayload);
}

export async function logout(): Promise<void> {
  const response = await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
  if (!response.ok) throw new Error(`Logout failed with status ${response.status}`);
}
