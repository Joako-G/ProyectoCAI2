import type { Role } from '../users/user.types.js';

/**
 * The single place that says who may do what. Routes ask for a capability, never for a role.
 * Capabilities marked "future" have no route yet; they are declared so the decision is recorded once.
 */
export const permissions = {
  'members:read': ['secretary', 'head_secretary'],
  'members:write': ['secretary', 'head_secretary'],
  'memberships:read': ['secretary', 'head_secretary'],
  'disciplines:read': ['secretary', 'head_secretary'],
  'disciplines:write': ['head_secretary'],
  'users:manage': ['head_secretary'],
  // Future (payments, configuration): declared with the decided roles, not used by any route yet.
  'payments:collect': ['secretary', 'head_secretary'],
  'payments:annul': ['head_secretary'],
  'cashcount:run': ['head_secretary'],
  'reports:read': ['secretary', 'head_secretary'],
  'config:manage': ['head_secretary'],
} as const satisfies Record<string, readonly Role[]>;

export type Capability = keyof typeof permissions;
