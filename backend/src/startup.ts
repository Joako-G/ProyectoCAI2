import type { MemberDisciplines } from './modules/memberships/membership.types.js';

export interface BootstrapDeps {
  memberService: { list(): Promise<MemberDisciplines[]> };
  membershipService: { reconcile(members: readonly MemberDisciplines[], date: string): Promise<void> };
  today: () => string;
  listen: () => void;
  log: (message: string, error: unknown) => void;
}

// Aligns the derived membership history with the members (the two JSON files cannot be written
// atomically together), then starts listening. The history is derived data, so a failed reconcile is
// logged and must not keep the server down: only the memberships routes then fail. The members are the
// primary data, so a failed members read is NOT caught and stops startup.
export async function bootstrap({ memberService, membershipService, today, listen, log }: BootstrapDeps): Promise<void> {
  const members = await memberService.list();
  try {
    await membershipService.reconcile(members, today());
  } catch (error) {
    log('Could not reconcile the membership history; starting without it', error);
  }
  listen();
}
