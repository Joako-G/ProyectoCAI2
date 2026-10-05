import type { MemberRepository } from './member.repository.js';
import type { MemberService } from './member.service.js';
import type { MemberInput } from './member.types.js';

export interface SeedEntry extends MemberInput {
  deactivationReason?: string;
}

export interface SeedOptions {
  service: MemberService;
  repository: MemberRepository;
  entries: SeedEntry[];
  force?: boolean;
}

export async function seedMembers({ service, repository, entries, force = false }: SeedOptions): Promise<number> {
  const existing = await repository.list();
  if (existing.length > 0 && !force) {
    throw new Error(`Members file already has data (${existing.length} members). Use --force to replace it.`);
  }
  if (existing.length > 0) await repository.mutate(() => ({ members: [], result: undefined }));

  for (const { deactivationReason, ...input } of entries) {
    const member = await service.create(input);
    if (deactivationReason) await service.deactivate(member.id, deactivationReason);
  }
  return entries.length;
}
