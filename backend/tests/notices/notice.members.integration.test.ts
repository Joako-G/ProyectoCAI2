import { afterEach, describe, expect, it } from 'vitest';
import { createNoticeService } from '../../src/modules/notices/notice.service.js';
import { createWaMeSender } from '../../src/modules/notices/notice.sender.js';
import { DEFAULT_PRORATION_RULE, DEFAULT_SURCHARGE_TIERS, DEFAULT_TARIFF } from '../../src/modules/payments/pricing.js';
import { adultInput, BASKET, trackContexts } from '../members/helpers.js';

const contexts = trackContexts();
afterEach(() => contexts.cleanup());

describe('notices read the stored member', () => {
  it('uses the new WhatsApp number after the member is edited', async () => {
    const { service: members } = await contexts.create();
    const created = await members.create(adultInput, 'actor');
    const notices = createNoticeService({
      members,
      memberships: { list: async () => [{ id: 'ms', memberId: created.id, disciplineId: BASKET, startDate: '2026-08-01', status: 'active', createdAt: '', updatedAt: '' }] },
      payments: { list: async () => [] },
      pricing: { get: async () => ({ tariffs: [DEFAULT_TARIFF], surchargeTiers: [...DEFAULT_SURCHARGE_TIERS], prorationRule: DEFAULT_PRORATION_RULE }) },
      disciplines: { findByIds: async () => [] },
      sender: createWaMeSender(),
      now: () => new Date('2026-11-01T15:00:00Z'),
    });

    await members.update(created.id, { ...adultInput, whatsapp: '3885188222' }, 'actor');

    const [row] = (await notices.debtNotices()).rows;
    expect(row!.link).toContain('https://wa.me/5493885188222');
  });
});
