import { createJsonStore } from '../../database/json-store.js';
import type { MemberRepository } from './member.repository.js';
import type { Member } from './member.types.js';

export function createJsonMemberRepository(filePath: string): MemberRepository {
  const store = createJsonStore<Member[]>(filePath, []);

  return {
    list: () => store.read(),
    async mutate(change) {
      let result!: ReturnType<typeof change>['result'];
      await store.update((members) => {
        const outcome = change(members);
        result = outcome.result;
        return outcome.members;
      });
      return result;
    },
  };
}
