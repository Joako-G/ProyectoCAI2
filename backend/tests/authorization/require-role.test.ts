import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { requireCapability, requireCapabilityByMethod, requireRole } from '../../src/middlewares/require-role.js';
import type { Authenticator } from '../../src/modules/auth/auth.session.js';
import type { Role } from '../../src/modules/users/user.types.js';

function userWith(role: string): ReturnType<Authenticator> {
  return { id: '1', name: 'Test', email: 'test@club.test', role: role as Role };
}

function run(handler: (req: Request, res: Response, next: () => void) => void, method = 'GET') {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const next = vi.fn();
  handler({ method } as Request, { status } as unknown as Response, next);
  return { status, json, next };
}

describe('requireRole', () => {
  it('answers 401 without a session', () => {
    const { status, json, next } = run(requireRole(() => null, 'secretary'));
    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('answers 403 for a role that is not allowed', () => {
    const { status, json, next } = run(requireRole(() => userWith('teacher'), 'secretary', 'head_secretary'));
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ error: 'Forbidden' });
    expect(next).not.toHaveBeenCalled();
  });

  it('answers 403 for a stored role that no longer exists', () => {
    const { status } = run(requireRole(() => userWith('owner'), 'secretary'));
    expect(status).toHaveBeenCalledWith(403);
  });

  it('calls next for an allowed role', () => {
    const { status, next } = run(requireRole(() => userWith('secretary'), 'secretary', 'head_secretary'));
    expect(next).toHaveBeenCalledOnce();
    expect(status).not.toHaveBeenCalled();
  });
});

describe('requireCapability', () => {
  it('resolves the allowed roles from the policy map', () => {
    expect(run(requireCapability(() => userWith('head_secretary'), 'users:manage')).next).toHaveBeenCalledOnce();
    expect(run(requireCapability(() => userWith('secretary'), 'users:manage')).status).toHaveBeenCalledWith(403);
  });
});

describe('requireCapabilityByMethod', () => {
  const guard = (role: string) => requireCapabilityByMethod(() => userWith(role), { read: 'members:read', write: 'members:write' });

  it('uses the read capability for GET and the write capability for other methods', () => {
    expect(run(guard('secretary'), 'GET').next).toHaveBeenCalledOnce();
    expect(run(guard('secretary'), 'POST').next).toHaveBeenCalledOnce();
    expect(run(guard('teacher'), 'GET').status).toHaveBeenCalledWith(403);
    expect(run(guard('teacher'), 'DELETE').status).toHaveBeenCalledWith(403);
  });
});
