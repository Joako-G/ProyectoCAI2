import type { RequestHandler } from 'express';
import type { Authenticator } from '../modules/auth/auth.session.js';
import { permissions, type Capability } from '../modules/auth/permissions.js';
import type { Role } from '../modules/users/user.types.js';

/** Answers 401 without a session and 403 when the signed-in user's role is not in `allowed`. */
export function requireRole(authenticate: Authenticator, ...allowed: readonly Role[]): RequestHandler {
  return (request, response, next) => {
    const user = authenticate(request);
    if (!user) {
      response.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!allowed.includes(user.role)) {
      response.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };
}

export function requireCapability(authenticate: Authenticator, capability: Capability): RequestHandler {
  return requireRole(authenticate, ...permissions[capability]);
}

/** Reads (GET, HEAD, OPTIONS) need `read`; every other method needs `write`. */
export function requireCapabilityByMethod(
  authenticate: Authenticator,
  capabilities: { read: Capability; write: Capability },
): RequestHandler {
  const read = requireCapability(authenticate, capabilities.read);
  const write = requireCapability(authenticate, capabilities.write);
  return (request, response, next) => (['GET', 'HEAD', 'OPTIONS'].includes(request.method) ? read : write)(request, response, next);
}
