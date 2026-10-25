import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hashPassword } from '../../src/modules/users/password.js';
import type { DemoUser, Role } from '../../src/modules/users/user.types.js';

export const TEST_PASSWORD = 'RolePass123!';

export function emailFor(role: string): string {
  return `${role}@club.test`;
}

/** Writes a users file with one active account per given role (new or legacy names) and returns its path. */
export async function createUsersFile(roles: readonly string[] = ['head_secretary', 'secretary', 'teacher']) {
  const dir = await mkdtemp(join(tmpdir(), 'authorization-'));
  const storePath = join(dir, 'users.json');
  const passwordHash = hashPassword(TEST_PASSWORD);
  const users = roles.map((role): Omit<DemoUser, 'role'> & { role: string } => ({
    id: `user-${role}`, name: `Test ${role}`, email: emailFor(role), passwordHash, role, active: true,
  }));
  await writeFile(storePath, JSON.stringify(users, null, 2));
  return { storePath, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

/** Logs in over HTTP and returns the session cookie header value. */
export async function signIn(baseUrl: string, role: Role | string = 'head_secretary'): Promise<string> {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: emailFor(role), password: TEST_PASSWORD }),
  });
  if (response.status !== 200) throw new Error(`Test login failed for ${role}: ${response.status}`);
  return response.headers.get('set-cookie')!.split(';')[0]!;
}
