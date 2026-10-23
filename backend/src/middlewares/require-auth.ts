import type { RequestHandler } from 'express';
import type { Authenticator } from '../modules/auth/auth.session.js';

/** Rejects requests without a valid session. Authentication only: it checks no roles or permissions. */
export function requireAuth(authenticate: Authenticator): RequestHandler {
  return (request, response, next) => {
    if (!authenticate(request)) {
      response.status(401).json({ error: 'Authentication required' });
      return;
    }
    next();
  };
}
