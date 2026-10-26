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
  // A teacher reads the students of the disciplines assigned to their own account (RF-20), nothing else.
  'roster:read': ['teacher'],
  // Payments: read, collect and annul are used by /api/payments. Cash count and reports are future.
  'payments:read': ['secretary', 'head_secretary'],
  'payments:collect': ['secretary', 'head_secretary'],
  'payments:annul': ['head_secretary'],
  'cashcount:run': ['head_secretary'],
  'reports:read': ['secretary', 'head_secretary'],
  'config:read': ['secretary', 'head_secretary'],
  'config:manage': ['head_secretary'],
} as const satisfies Record<string, readonly Role[]>;

export type Capability = keyof typeof permissions;

/** Every capability granted to a role; an unknown role gets none. */
export function capabilitiesFor(role: string): Capability[] {
  return (Object.keys(permissions) as Capability[]).filter((capability) =>
    (permissions[capability] as readonly string[]).includes(role));
}
