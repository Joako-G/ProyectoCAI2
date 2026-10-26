import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJsonPaymentRepository } from '../../src/modules/payments/json-payment.repository.js';
import { createJsonPricingConfigRepository } from '../../src/modules/payments/json-pricing-config.repository.js';
import { createPaymentService } from '../../src/modules/payments/payment.service.js';
import { createPricingConfigService } from '../../src/modules/payments/pricing-config.service.js';
import type { Membership } from '../../src/modules/memberships/membership.types.js';
import { NotFoundError } from '../../src/shared/errors.js';

/** 2026-10-05 in the club time zone: day 5 has no surcharge. */
export const TODAY = new Date('2026-10-05T15:00:00Z');
export const MEMBER_ID = 'member-lucia';
export const ACTOR = 'user-secretary';

export interface FakeMember {
  id: string;
  status: 'active' | 'inactive';
  deactivation?: { date: string };
}

export function membership(disciplineId: string, startDate: string, endDate?: string, memberId = MEMBER_ID): Membership {
  return {
    id: `${memberId}-${disciplineId}-${startDate}`,
    memberId,
    disciplineId,
    startDate,
    status: endDate ? 'ended' : 'active',
    ...(endDate ? { endDate } : {}),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

export async function createTestContext(
  options: { now?: () => Date; members?: FakeMember[]; memberships?: Membership[] } = {},
) {
  const dir = await mkdtemp(join(tmpdir(), 'payments-'));
  const file = join(dir, 'payments.json');
  const pricingFile = join(dir, 'pricing-config.json');
  const members = options.members ?? [{ id: MEMBER_ID, status: 'active' as const }];
  const memberships = options.memberships ?? [membership('basket', '2026-01-01')];
  const now = options.now ?? (() => TODAY);
  const pricing = createPricingConfigService({ repository: createJsonPricingConfigRepository(pricingFile), now });
  const repository = createJsonPaymentRepository(file);
  const service = createPaymentService({
    repository,
    now,
    pricing,
    members: {
      getById: async (id) => {
        const member = members.find((candidate) => candidate.id === id);
        if (!member) throw new NotFoundError('Member not found');
        return member;
      },
    },
    memberships: { list: async ({ memberId }) => memberships.filter((entry) => entry.memberId === memberId) },
  });
  return { service, repository, pricing, members, memberships, file, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

export function trackContexts() {
  const cleanups: Array<() => Promise<void>> = [];
  return {
    async create(options?: Parameters<typeof createTestContext>[0]) {
      const context = await createTestContext(options);
      cleanups.push(context.cleanup);
      return context;
    },
    async cleanup() {
      while (cleanups.length > 0) await cleanups.pop()!();
    },
  };
}
