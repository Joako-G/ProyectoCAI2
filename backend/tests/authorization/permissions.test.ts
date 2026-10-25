import { describe, expect, it } from 'vitest';
import { permissions, type Capability } from '../../src/modules/auth/permissions.js';
import { roles } from '../../src/modules/users/user.types.js';

describe('permission policy', () => {
  const allowed = (capability: Capability) => [...permissions[capability]].sort();

  it('lets only the head secretary manage users, configuration, annulments, cash counts and discipline writes', () => {
    for (const capability of ['users:manage', 'config:manage', 'payments:annul', 'cashcount:run', 'disciplines:write'] as const) {
      expect(allowed(capability)).toEqual(['head_secretary']);
    }
  });

  it('lets the secretary read and write members and read disciplines and memberships', () => {
    for (const capability of ['members:read', 'members:write', 'disciplines:read', 'memberships:read'] as const) {
      expect(allowed(capability)).toEqual(['head_secretary', 'secretary']);
    }
  });

  it('gives the teacher no capability yet and only declares known roles', () => {
    for (const capability of Object.keys(permissions) as Capability[]) {
      expect(permissions[capability]).not.toContain('teacher');
      for (const role of permissions[capability]) expect(roles).toContain(role);
    }
  });
});
