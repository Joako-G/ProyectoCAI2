import { Router, type CookieOptions } from 'express';
import type { AuthService } from './auth.service.js';
import { SESSION_COOKIE, readSessionToken, type Authenticator, type SessionStore } from './auth.session.js';

const cookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  secure: process.env.NODE_ENV === 'production',
};

export function createAuthRouter(service: AuthService, sessions: SessionStore, authenticate: Authenticator): Router {
  const router = Router();

  router.post('/login', (request, response) => {
    const user = service.login(request.body);
    if (!user) {
      response.status(401).json({ error: 'Invalid email or password' });
      return;
    }
    response.cookie(SESSION_COOKIE, sessions.create(user.id), cookieOptions);
    response.json({ user });
  });

  router.get('/me', (request, response) => {
    const user = authenticate(request);
    if (!user) {
      response.status(401).json({ error: 'Authentication required' });
      return;
    }
    response.json({ user });
  });

  router.post('/logout', (request, response) => {
    const token = readSessionToken(request);
    if (token) sessions.destroy(token);
    response.clearCookie(SESSION_COOKIE, cookieOptions);
    response.status(204).end();
  });

  return router;
}
