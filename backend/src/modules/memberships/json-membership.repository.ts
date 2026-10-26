import { createJsonStore } from '../../database/json-store.js';
import type { MembershipRepository } from './membership.repository.js';
import type { Membership } from './membership.types.js';

const REQUIRED_TEXT_FIELDS = ['id', 'memberId', 'disciplineId', 'startDate', 'createdAt', 'updatedAt'] as const;

function isWellShaped(value: unknown): value is Membership {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (!REQUIRED_TEXT_FIELDS.every((field) => typeof record[field] === 'string')) return false;
  if (record.status === 'active') return true;
  return record.status === 'ended' && typeof record.endDate === 'string';
}

export function createJsonMembershipRepository(filePath: string): MembershipRepository {
  const store = createJsonStore<Membership[]>(filePath, []);

  // A parsed-but-wrong shape must never reach a mutation: writing back would destroy the file.
  function assertMemberships(value: unknown): Membership[] {
    if (!Array.isArray(value) || !value.every(isWellShaped)) {
      throw new Error(`Invalid memberships file ${filePath}: it must contain a JSON array of memberships`);
    }
    return value;
  }

  return {
    list: async () => assertMemberships(await store.read()),
    async mutate(change) {
      let result!: ReturnType<typeof change>['result'];
      await store.update((current) => {
        const outcome = change(assertMemberships(current));
        result = outcome.result;
        return outcome.memberships;
      });
      return result;
    },
  };
}
