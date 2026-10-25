import type { AuthUser, Capability } from '../types/auth';

/** Whether the signed-in user holds a capability. This only shapes the UI; the server enforces it. */
export function can(user: Pick<AuthUser, 'capabilities'> | null | undefined, capability: Capability): boolean {
  return user?.capabilities.includes(capability) ?? false;
}
