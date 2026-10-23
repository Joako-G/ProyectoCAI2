import { Router } from 'express';
import type { AuthService } from './auth.service.js';

export function createAuthRouter(service: AuthService): Router {
  const router = Router();

  router.post('/login', (request, response) => {
    const user = service.login(request.body);
    if (!user) {
      response.status(401).json({ error: 'Invalid email or password' });
      return;
    }
    response.json({ user });
  });

  return router;
}
