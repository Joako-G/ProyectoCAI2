import express from 'express';
import { scryptSync, timingSafeEqual } from 'node:crypto';
import demoUsers from './database/demo-users.json';

interface DemoUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: string;
  active: boolean;
}

const users = demoUsers as DemoUser[];

export const app = express();

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

  const user = users.find((candidate) => candidate.email.toLowerCase() === email.toLowerCase());
  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
    response.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const { id, name, role } = user;
  response.json({ user: { id, name, email: user.email, role } });
});

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash || !/^[\da-f]+$/i.test(hash)) return false;

  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
