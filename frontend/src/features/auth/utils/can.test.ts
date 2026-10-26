import { describe, expect, it } from 'vitest';
import { can } from './can';

const base = { id: '1', name: 'Demo', email: 'demo@example.com', role: 'secretary' };

describe('can', () => {
  it('is true only for a capability the user holds', () => {
    const user = { ...base, capabilities: ['members:read' as const] };

    expect(can(user, 'members:read')).toBe(true);
    expect(can(user, 'members:write')).toBe(false);
  });

  it('is false without a signed-in user', () => {
    expect(can(null, 'members:read')).toBe(false);
    expect(can(undefined, 'members:read')).toBe(false);
  });

  it('is false for a user with no capabilities', () => {
    expect(can({ ...base, capabilities: [] }, 'users:manage')).toBe(false);
  });
});
