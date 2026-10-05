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
