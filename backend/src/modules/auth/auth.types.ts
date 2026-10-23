import type { SafeUser } from '../users/user.types.js';

/** The account data returned to the client after a successful sign-in. */
export type AuthenticatedUser = Omit<SafeUser, 'active'>;
