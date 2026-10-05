import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let directory;
let storePath;
let server;
let baseUrl;
let createApp;

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'club-socios-users-'));
  storePath = join(directory, 'users.json');
  ({ createApp } = await import('../dist/app.js'));
  server = createApp({ storePath }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (directory) await rm(directory, { recursive: true, force: true });
});

async function request(path, method = 'GET', body) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

test('lists safe user fields and creates users with a server-generated scrypt hash', async () => {
  const initial = await request('/users');
  assert.equal(initial.status, 200);
  const initialUsers = await initial.json();
  assert.ok(initialUsers.length >= 2);
  assert.ok(initialUsers.every((user) => Object.keys(user).sort().join(',') === 'active,email,id,name,role'));

  const created = await request('/users', 'POST', {
    name: 'New Member', email: 'new@club.test', role: 'member', password: 'ValidPass123!',
    passwordHash: 'attacker-controlled-hash',
  });
  assert.equal(created.status, 201);
  const user = await created.json();
  assert.deepEqual(Object.keys(user).sort(), ['active', 'email', 'id', 'name', 'role']);
  assert.equal(user.email, 'new@club.test');

  const persisted = JSON.parse(await readFile(storePath, 'utf8'));
  const stored = persisted.find((candidate) => candidate.id === user.id);
  assert.match(stored.passwordHash, /^[\da-f]+:[\da-f]+$/i);
  assert.notEqual(stored.passwordHash, 'attacker-controlled-hash');
  assert.equal(JSON.stringify(user).includes('passwordHash'), false);
});

test('rejects invalid fields and case-insensitive duplicate email', async () => {
  for (const body of [
    { name: '', email: 'bad', role: 'owner', password: 'short' },
    { name: 'Valid Name', email: 'not-an-email', role: 'member', password: 'ValidPass123!' },
    { name: 'Valid Name', email: 'valid@club.test', role: 'owner', password: 'ValidPass123!' },
    { name: 'Valid Name', email: 'valid@club.test', role: 'member', password: 'short' },
  ]) {
    assert.equal((await request('/users', 'POST', body)).status, 400);
  }
  assert.equal((await request('/users', 'POST', {
    name: 'Duplicate', email: 'DEMO@CLUB.TEST', role: 'member', password: 'ValidPass123!',
  })).status, 409);
});

test('updates and logically deactivates users; safe update can reactivate', async () => {
  const created = await request('/users', 'POST', {
    name: 'Lifecycle User', email: 'lifecycle@club.test', role: 'member', password: 'ValidPass123!',
  });
  const user = await created.json();
  const updated = await request(`/users/${user.id}`, 'PATCH', { name: 'Updated User', active: false });
  assert.equal(updated.status, 200);
  assert.deepEqual(await updated.json(), { ...user, name: 'Updated User', active: false });
  assert.equal((await request('/auth/login', 'POST', { email: user.email, password: 'ValidPass123!' })).status, 401);

  const rejectedHash = await request(`/users/${user.id}`, 'PATCH', { active: true, passwordHash: 'forged' });
  assert.equal(rejectedHash.status, 400);
  const reactivated = await request(`/users/${user.id}`, 'PATCH', { active: true });
  assert.equal(reactivated.status, 200);
  assert.equal((await reactivated.json()).active, true);
  assert.equal((await request('/auth/login', 'POST', { email: user.email, password: 'ValidPass123!' })).status, 200);
});

test('DELETE deactivates and a newly loaded app reads the same persistent users', async () => {
  const created = await request('/users', 'POST', {
    name: 'Persistent User', email: 'persistent@club.test', role: 'member', password: 'ValidPass123!',
  });
  const user = await created.json();
  assert.equal((await request(`/users/${user.id}`, 'DELETE')).status, 200);
  assert.equal((await request('/auth/login', 'POST', { email: user.email, password: 'ValidPass123!' })).status, 401);

  const reloaded = createApp({ storePath });
  const reloadedServer = reloaded.listen(0);
  await new Promise((resolve) => reloadedServer.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${reloadedServer.address().port}/users`);
    const users = await response.json();
    assert.equal(users.find((candidate) => candidate.id === user.id).active, false);
  } finally {
    await new Promise((resolve, reject) => reloadedServer.close((error) => error ? reject(error) : resolve()));
  }
});
