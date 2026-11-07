import { describe, expect, it, vi } from 'vitest';
import { createMemberService } from '../../src/modules/members/member.service.js';
import { noAudit } from '../audit/helpers.js';
import { adultInput, createTestContext, fakeDisciplineLookup, TODAY } from './helpers.js';

async function setup(onMemberDeactivated: (memberId: string, actorId: string) => Promise<void>) {
  const ctx = await createTestContext();
  const service = createMemberService({
    repository: ctx.repository,
    disciplineLookup: fakeDisciplineLookup(),
    audit: noAudit,
    now: () => TODAY,
    lifecycle: { onMemberDeactivated },
  });
  return { service, cleanup: ctx.cleanup };
}

describe('deactivate lifecycle hook', () => {
  it('tells the lifecycle port which member was deactivated and by whom', async () => {
    const hook = vi.fn(async () => undefined);
    const { service, cleanup } = await setup(hook);
    try {
      const member = await service.create(adultInput, 'user-1');
      await service.deactivate(member.id, 'Baja voluntaria', 'user-2');
      expect(hook).toHaveBeenCalledWith(member.id, 'user-2');
    } finally {
      await cleanup();
    }
  });

  it('still deactivates, and logs, when the hook fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { service, cleanup } = await setup(async () => {
      throw new Error('faces down');
    });
    try {
      const member = await service.create(adultInput, 'user-1');
      const result = await service.deactivate(member.id, 'Baja voluntaria', 'user-2');
      expect(result.status).toBe('inactive');
      expect(error).toHaveBeenCalled();
    } finally {
      error.mockRestore();
      await cleanup();
    }
  });
});
