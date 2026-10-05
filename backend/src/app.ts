import express from 'express';
import { randomBytes, scryptSync, timingSafeEqual, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import demoUsers from './database/demo-users.json';

interface DemoUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: string;
  active: boolean;
}

const defaultStorePath = join(__dirname, '..', 'data', 'users.json');

class UserRepository {
  private users: DemoUser[];

  constructor(private readonly storePath: string, private readonly persistOverride?: (users: DemoUser[]) => void) {
    if (!existsSync(storePath)) {
      mkdirSync(dirname(storePath), { recursive: true });
      writeFileSync(storePath, `${JSON.stringify(demoUsers, null, 2)}\n`, { flag: 'wx' });
    }
    this.users = JSON.parse(readFileSync(storePath, 'utf8')) as DemoUser[];
  }

  list(): DemoUser[] { return this.users; }
  save(users: DemoUser[]): void {
    if (this.persistOverride) { this.persistOverride(users); return; }
    const temporaryPath = `${this.storePath}.${randomUUID()}.tmp`;
    try {
      writeFileSync(temporaryPath, `${JSON.stringify(users, null, 2)}\n`, { flag: 'wx' });
      renameSync(temporaryPath, this.storePath);
    } finally {
      if (existsSync(temporaryPath)) {
        try { unlinkSync(temporaryPath); } catch { /* Best-effort cleanup. */ }
      }
    }
  }
  replace(users: DemoUser[]): void { this.save(users); this.users = users; }
}

export function createApp(options: { storePath?: string; persist?: (users: DemoUser[]) => void } = {}) {
const repository = new UserRepository(options.storePath ?? defaultStorePath, options.persist);
const app = express();

app.use(express.json());

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.post('/auth/login', (request, response) => {
  const { email, password } = request.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    response.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const user = repository.list().find((candidate) => candidate.email.toLowerCase() === email.toLowerCase());
  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
    response.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const { id, name, role } = user;
  response.json({ user: { id, name, email: user.email, role } });
});

app.get('/users', (_request, response) => response.json(repository.list().map(safeUser)));

app.post('/users', (request, response) => {
  const { name, email, role, password } = request.body ?? {};
  if (!validName(name) || !validEmail(email) || !validRole(role) || !validPassword(password)) {
    response.status(400).json({ error: 'Invalid user fields' });
    return;
  }
  if (repository.list().some((user) => user.email.toLowerCase() === email.trim().toLowerCase())) {
    response.status(409).json({ error: 'Email already exists' });
    return;
  }
  const user: DemoUser = { id: randomUUID(), name: name.trim(), email: email.trim(), role, passwordHash: hashPassword(password), active: true };
  try { repository.replace([...repository.list(), user]); } catch { response.status(500).json({ error: 'Unable to save users' }); return; }
  response.status(201).json(safeUser(user));
});

app.patch('/users/:id', (request, response) => {
  const user = repository.list().find((candidate) => candidate.id === request.params.id);
  if (!user) { response.status(404).json({ error: 'User not found' }); return; }
  const body = request.body ?? {};
  const allowed = new Set(['name', 'email', 'role', 'active', 'password']);
  if (Object.keys(body).some((key) => !allowed.has(key)) || Object.hasOwn(body, 'passwordHash') ||
      (body.name !== undefined && !validName(body.name)) || (body.email !== undefined && !validEmail(body.email)) ||
      (body.role !== undefined && !validRole(body.role)) || (body.active !== undefined && typeof body.active !== 'boolean') ||
      (body.password !== undefined && !validPassword(body.password)) || Object.keys(body).length === 0) {
    response.status(400).json({ error: 'Invalid user fields' }); return;
  }
  if (body.email !== undefined && repository.list().some((candidate) => candidate.id !== user.id && candidate.email.toLowerCase() === body.email.trim().toLowerCase())) {
    response.status(409).json({ error: 'Email already exists' }); return;
  }
  const updated = { ...user };
  if (body.name !== undefined) updated.name = body.name.trim();
  if (body.email !== undefined) updated.email = body.email.trim();
  if (body.role !== undefined) updated.role = body.role;
  if (body.active !== undefined) updated.active = body.active;
  if (body.password !== undefined) updated.passwordHash = hashPassword(body.password);
  try { repository.replace(repository.list().map((candidate) => candidate.id === user.id ? updated : candidate)); }
  catch { response.status(500).json({ error: 'Unable to save users' }); return; }
  response.json(safeUser(updated));
});

app.delete('/users/:id', (request, response) => {
  const user = repository.list().find((candidate) => candidate.id === request.params.id);
  if (!user) { response.status(404).json({ error: 'User not found' }); return; }
  const updated = { ...user, active: false };
  try { repository.replace(repository.list().map((candidate) => candidate.id === user.id ? updated : candidate)); }
  catch { response.status(500).json({ error: 'Unable to save users' }); return; }
  response.json(safeUser(updated));
});

return app;
}

let defaultApp: express.Express | undefined;
export const app = express();
app.use((request, response, next) => {
  defaultApp ??= createApp();
  defaultApp(request, response, next);
});

function safeUser({ id, name, email, role, active }: DemoUser) { return { id, name, email, role, active }; }
function validName(value: unknown): value is string { return typeof value === 'string' && value.trim().length >= 2 && value.trim().length <= 100; }
function validEmail(value: unknown): value is string { return typeof value === 'string' && value.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()); }
function validRole(value: unknown): value is string { return value === 'member' || value === 'admin'; }
function validPassword(value: unknown): value is string { return typeof value === 'string' && value.length >= 8 && value.length <= 128; }
function hashPassword(password: string): string { const salt = randomBytes(16).toString('hex'); return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`; }

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash || !/^[\da-f]+$/i.test(hash)) return false;

  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
