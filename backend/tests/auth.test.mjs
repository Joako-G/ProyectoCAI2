import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';

let server;
let baseUrl;
let directory;

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'club-socios-auth-'));
  const { createApp } = await import('../dist/app.js');
  const app = createApp({ storePath: join(directory, 'users.json') });
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (directory) await rm(directory, { recursive: true, force: true });
});

test('authenticates a synthetic active user and returns only safe fields', async () => {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'demo@club.test', password: 'DemoPass123!' }),
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(payload, {
    user: { id: 'demo-member', name: 'Demo Member', email: 'demo@club.test', role: 'member' },
  });
  assert.equal(JSON.stringify(payload).includes('password'), false);
});

test('rejects invalid credentials without disclosing account state', async () => {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'demo@club.test', password: 'wrong' }),
  });

  assert.equal(response.status, 401);
});

test('rejects inactive accounts', async () => {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'inactive@club.test', password: 'DemoPass123!' }),
  });

  assert.equal(response.status, 401);
});

test('stores synthetic users with hashes and no plaintext passwords', async () => {
  const data = await readFile(new URL('../src/database/demo-users.json', import.meta.url), 'utf8');
  const users = JSON.parse(data);

  assert.equal(users.length, 2);
  assert.ok(users.every(({ id, name, email, passwordHash, role, active }) =>
    id && name && email.endsWith('.test') && passwordHash.includes(':') && role && typeof active === 'boolean'));
  assert.equal(data.includes('DemoPass123!'), false);
  assert.ok(users.every((user) => !Object.hasOwn(user, 'password')));
});

async function signIn() {
  return fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'demo@club.test', password: 'DemoPass123!' }),
  });
}

test('login sets an httpOnly, SameSite=Lax session cookie', async () => {
  const response = await signIn();
  const cookie = response.headers.get('set-cookie');

  assert.match(cookie, /^club_session=[\da-f]{64};/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
});

test('failed login does not set a session cookie', async () => {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'demo@club.test', password: 'wrong' }),
  });

  assert.equal(response.headers.get('set-cookie'), null);
});

test('/auth/me returns the session user with the cookie and 401 without it', async () => {
  const cookie = (await signIn()).headers.get('set-cookie').split(';')[0];

  const withCookie = await fetch(`${baseUrl}/auth/me`, { headers: { cookie } });
  assert.equal(withCookie.status, 200);
  assert.deepEqual(await withCookie.json(), {
    user: { id: 'demo-member', name: 'Demo Member', email: 'demo@club.test', role: 'member' },
  });

  assert.equal((await fetch(`${baseUrl}/auth/me`)).status, 401);
  assert.equal((await fetch(`${baseUrl}/auth/me`, { headers: { cookie: 'club_session=forged' } })).status, 401);
});

test('logout answers 204, clears the cookie and invalidates the session on the server', async () => {
  const cookie = (await signIn()).headers.get('set-cookie').split(';')[0];

  const logout = await fetch(`${baseUrl}/auth/logout`, { method: 'POST', headers: { cookie } });
  assert.equal(logout.status, 204);
  assert.match(logout.headers.get('set-cookie'), /^club_session=;/);

  // The old token is rejected even if the client keeps sending it.
  assert.equal((await fetch(`${baseUrl}/auth/me`, { headers: { cookie } })).status, 401);
});

test('logout without a session is harmless', async () => {
  const response = await fetch(`${baseUrl}/auth/logout`, { method: 'POST' });

  assert.equal(response.status, 204);
});

test('/users requires a session while members and disciplines stay unprotected', async () => {
  assert.equal((await fetch(`${baseUrl}/users`)).status, 401);

  const cookie = (await signIn()).headers.get('set-cookie').split(';')[0];
  assert.equal((await fetch(`${baseUrl}/users`, { headers: { cookie } })).status, 200);
  await fetch(`${baseUrl}/auth/logout`, { method: 'POST', headers: { cookie } });
  assert.equal((await fetch(`${baseUrl}/users`, { headers: { cookie } })).status, 401);

  // No members/disciplines service is wired in this app, so an unprotected API route answers 404, never 401.
  assert.equal((await fetch(`${baseUrl}/api/members`)).status, 404);
});

test('CORS allows credentialed requests only from the front-end origin', async () => {
  const allowed = await fetch(`${baseUrl}/auth/me`, { headers: { origin: 'http://localhost:5173' } });
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  assert.equal(allowed.headers.get('access-control-allow-credentials'), 'true');

  const other = await fetch(`${baseUrl}/auth/me`, { headers: { origin: 'http://evil.example' } });
  assert.notEqual(other.headers.get('access-control-allow-origin'), 'http://evil.example');
});
