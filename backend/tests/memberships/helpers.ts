import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJsonMembershipRepository } from '../../src/modules/memberships/json-membership.repository.js';
import { createMembershipService } from '../../src/modules/memberships/membership.service.js';

export const TODAY = new Date('2026-10-05T15:00:00Z');

export const LUCIA = 'member-lucia';
export const TOMAS = 'member-tomas';
export const BASKET = 'disc-basket';
export const VOLLEY = 'disc-volley';
export const SWIM = 'disc-swim';

export async function createTestContext(now: () => Date = () => TODAY) {
  const dir = await mkdtemp(join(tmpdir(), 'memberships-'));
  const file = join(dir, 'memberships.json');
  const repository = createJsonMembershipRepository(file);
  const service = createMembershipService({ repository, now });
  return { service, repository, file, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

export function trackContexts() {
  const cleanups: Array<() => Promise<void>> = [];
  return {
    async create(now?: () => Date) {
      const context = await createTestContext(now);
      cleanups.push(context.cleanup);
      return context;
    },
    async cleanup() {
      while (cleanups.length > 0) await cleanups.pop()!();
    },
  };
}
