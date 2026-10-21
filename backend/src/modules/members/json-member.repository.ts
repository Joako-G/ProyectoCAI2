import { createJsonStore } from '../../database/json-store.js';
import type { MemberRepository } from './member.repository.js';
import type { Member } from './member.types.js';

export function createJsonMemberRepository(filePath: string): MemberRepository {
  const store = createJsonStore<Member[]>(filePath, []);

  // A parsed-but-wrong shape must never reach a mutation: writing back would destroy the file.
  function assertMembers(value: unknown): Member[] {
    if (!Array.isArray(value)) {
      throw new Error(`Invalid members file ${filePath}: it must contain a JSON array of members`);
    }
    // Members stored before disciplines existed have no list; they read as unassigned.
    return (value as Member[]).map((member) =>
      typeof member === 'object' && member !== null && !Array.isArray(member.disciplineIds)
        ? { ...member, disciplineIds: [] }
        : member,
    );
  }

  return {
    list: async () => assertMembers(await store.read()),
    async mutate(change) {
      let result!: ReturnType<typeof change>['result'];
      await store.update((current) => {
        const outcome = change(assertMembers(current));
        result = outcome.result;
        return outcome.members;
      });
      return result;
    },
  };
}
