import type { Membership } from './membership.types.js';

export interface MembershipMutation<R> {
  memberships: Membership[];
  result: R;
}

export interface MembershipRepository {
  list(): Promise<Membership[]>;
  // Runs read-check-write as one unit; throwing inside `change` aborts without writing.
  mutate<R>(change: (memberships: Membership[]) => MembershipMutation<R>): Promise<R>;
}
