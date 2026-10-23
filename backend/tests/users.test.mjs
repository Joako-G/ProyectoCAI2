import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let directory;
let storePath;
let server;
let baseUrl;
let createApp;
let sessionCookie;

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'club-socios-users-'));
  storePath = join(directory, 'users.json');
  ({ createApp } = await import('../dist/app.js'));
  server = createApp({ storePath }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  sessionCookie = await signInAt(baseUrl);
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (directory) await rm(directory, { recursive: true, force: true });
});

async function signInAt(url) {
  const login = await fetch(`${url}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'demo@club.test', password: 'DemoPass123!' }),
  });
  return login.headers.get('set-cookie').split(';')[0];
}

async function request(path, method = 'GET', body) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { cookie: sessionCookie, ...(body ? { 'content-type': 'application/json' } : {}) },
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
    const reloadedUrl = `http://127.0.0.1:${reloadedServer.address().port}`;
    const response = await fetch(`${reloadedUrl}/users`, { headers: { cookie: await signInAt(reloadedUrl) } });
    const users = await response.json();
    assert.equal(users.find((candidate) => candidate.id === user.id).active, false);
  } finally {
    await new Promise((resolve, reject) => reloadedServer.close((error) => error ? reject(error) : resolve()));
  }
});

test('failed persistence does not expose a created user or persistence details', async () => {
  const failingApp = createApp({
    storePath: join(directory, 'failing-users.json'),
    persist: () => { throw new Error('private store path'); },
  });
  const failingServer = failingApp.listen(0);
  await new Promise((resolve) => failingServer.once('listening', resolve));
  try {
    const url = `http://127.0.0.1:${failingServer.address().port}`;
    const cookie = await signInAt(url);
    const createResponse = await fetch(`${url}/users`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ name: 'Failure User', email: 'failure@club.test', role: 'member', password: 'ValidPass123!' }),
    });
    assert.equal(createResponse.status, 500);
    assert.deepEqual(await createResponse.json(), { error: 'Unable to save users' });

    const before = await (await fetch(`${url}/users`, { headers: { cookie } })).json();
    const existing = before[0];
    const patchResponse = await fetch(`${url}/users/${existing.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ name: 'Uncommitted Name' }),
    });
    assert.equal(patchResponse.status, 500);
    const deleteResponse = await fetch(`${url}/users/${existing.id}`, { method: 'DELETE', headers: { cookie } });
    assert.equal(deleteResponse.status, 500);

    const listResponse = await fetch(`${url}/users`, { headers: { cookie } });
    assert.equal(listResponse.status, 200);
    const after = await listResponse.json();
    assert.equal(after.some((user) => user.email === 'failure@club.test'), false);
    assert.deepEqual(after.find((user) => user.id === existing.id), existing);
  } finally {
    await new Promise((resolve, reject) => failingServer.close((error) => error ? reject(error) : resolve()));
  }
});

test('malformed store fails closed without replacing its contents', async () => {
  const malformedPath = join(directory, 'malformed-users.json');
  const malformed = '{not valid json';
  await writeFile(malformedPath, malformed);
  assert.throws(() => createApp({ storePath: malformedPath }));
  assert.equal(await readFile(malformedPath, 'utf8'), malformed);
});
