import type { Member } from './member.types.js';

export interface MemberMutation<R> {
  members: Member[];
  result: R;
}

export interface MemberRepository {
  list(): Promise<Member[]>;
  // Runs read-check-write as one unit; throwing inside `change` aborts without writing.
  mutate<R>(change: (members: Member[]) => MemberMutation<R>): Promise<R>;
}
