import type { DisciplineLookup } from './discipline-lookup.js';
import type { MemberRepository } from './member.repository.js';
import { createMemberService } from './member.service.js';
import type { Member, MemberInput } from './member.types.js';

export interface SeedEntry extends MemberInput {
  deactivationReason?: string;
}

export interface SeedOptions {
  repository: MemberRepository;
  // Entries must reference disciplines this lookup knows (the seeded catalog).
  disciplineLookup: DisciplineLookup;
  entries: SeedEntry[];
  force?: boolean;
  now?: () => Date;
}

function createInMemoryRepository(): MemberRepository {
  let members: Member[] = [];
  return {
    list: async () => members,
    async mutate(change) {
      const outcome = change(members);
      members = outcome.members;
      return outcome.result;
    },
  };
}

// Entries go through the service on a scratch repository, so every rule is checked before the target is written once.
export async function buildSeededMembers(
  entries: SeedEntry[],
  disciplineLookup: DisciplineLookup,
  now?: () => Date,
): Promise<Member[]> {
  const scratch = createInMemoryRepository();
  const service = createMemberService({ repository: scratch, disciplineLookup, now });
  for (const { deactivationReason, ...input } of entries) {
    const member = await service.create(input);
    if (deactivationReason) await service.deactivate(member.id, deactivationReason);
  }
  return scratch.list();
}

export function assertCanSeedMembers(existing: Member[], force: boolean): void {
  if (existing.length > 0 && !force) {
    throw new Error(`Members file already has data (${existing.length} members). Use --force to replace it.`);
  }
}

export async function seedMembers({
  repository,
  disciplineLookup,
  entries,
  force = false,
  now,
}: SeedOptions): Promise<number> {
  const seeded = await buildSeededMembers(entries, disciplineLookup, now);
  await repository.mutate((existing) => {
    assertCanSeedMembers(existing, force);
    return { members: seeded, result: undefined };
  });
  return entries.length;
}
