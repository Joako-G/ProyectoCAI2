import { describe, expect, it } from 'vitest';
import { capabilitiesFor, permissions, type Capability } from '../../src/modules/auth/permissions.js';
import { roles } from '../../src/modules/users/user.types.js';

describe('permission policy', () => {
  const allowed = (capability: Capability) => [...permissions[capability]].sort();

  it('lets only the head secretary manage users, configuration, annulments, cash counts and discipline writes', () => {
    for (const capability of ['users:manage', 'config:manage', 'payments:annul', 'cashcount:run', 'disciplines:write'] as const) {
      expect(allowed(capability)).toEqual(['head_secretary']);
    }
  });

  it('lets the secretary read and write members and read disciplines, memberships and pricing configuration', () => {
    for (const capability of ['members:read', 'members:write', 'disciplines:read', 'memberships:read', 'config:read'] as const) {
      expect(allowed(capability)).toEqual(['head_secretary', 'secretary']);
    }
  });

  it('derives the capabilities of a role from the policy and gives unknown roles none', () => {
    expect(capabilitiesFor('head_secretary')).toEqual(Object.keys(permissions).filter((capability) => capability !== 'roster:read'));
    expect(capabilitiesFor('secretary')).toContain('members:write');
    expect(capabilitiesFor('secretary')).not.toContain('disciplines:write');
    expect(capabilitiesFor('secretary')).not.toContain('users:manage');
    expect(capabilitiesFor('teacher')).toEqual(['roster:read']);
    expect(capabilitiesFor('treasurer')).toEqual([]);
  });

  it('gives the teacher only the roster of their own disciplines and declares only known roles', () => {
    expect(allowed('roster:read')).toEqual(['teacher']);
    for (const capability of Object.keys(permissions) as Capability[]) {
      if (capability !== 'roster:read') expect(permissions[capability]).not.toContain('teacher');
      for (const role of permissions[capability]) expect(roles).toContain(role);
    }
  });
});
