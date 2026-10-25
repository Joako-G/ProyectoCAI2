import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createJsonMemberRepository } from '../../src/modules/members/json-member.repository.js';
import { createMemberService } from '../../src/modules/members/member.service.js';
import { bootstrap } from '../../src/startup.js';
import { adultInput, BASKET, fakeDisciplineLookup, VOLLEY } from '../members/helpers.js';
import { trackContexts } from './helpers.js';

const contexts = trackContexts();
const dirs: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await contexts.cleanup();
  while (dirs.length > 0) await rm(dirs.pop()!, { recursive: true, force: true });
});

describe('history repair after a failed sync', () => {
  it('dates the repair with the edit date, not the restart date', async () => {
    const { service: memberships } = await contexts.create();
    const dir = await mkdtemp(join(tmpdir(), 'members-repair-'));
    dirs.push(dir);
    let instant = new Date('2026-10-01T15:00:00Z');
    let failing = false;
    const members = createMemberService({
      repository: createJsonMemberRepository(join(dir, 'members.json')),
      disciplineLookup: fakeDisciplineLookup(),
      now: () => instant,
      disciplineHistory: {
        onDisciplinesChanged: async (id, ids, date) => {
          if (failing) throw new Error('history down');
          await memberships.syncMember(id, ids, date);
        },
      },
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const member = await members.create({ ...adultInput, disciplineIds: [BASKET] });
    instant = new Date('2026-10-05T15:00:00Z');
    failing = true;
    await members.update(member.id, { ...adultInput, disciplineIds: [VOLLEY] });

    // "Restart" on a later date.
    await memberships.reconcile(await members.list(), '2026-11-20');

    expect((await memberships.list({ disciplineId: BASKET }))[0]).toMatchObject({ status: 'ended', endDate: '2026-10-05' });
    expect((await memberships.list({ disciplineId: VOLLEY }))[0]).toMatchObject({ status: 'active', startDate: '2026-10-05' });
  });
});

describe('startup bootstrap', () => {
  const deps = (reconcile: () => Promise<void>, calls: string[]) => ({
    memberService: { list: async () => [{ id: 'm', disciplineIds: [BASKET], memberSince: '2020-01-01' }] },
    membershipService: {
      reconcile: async () => {
        calls.push('reconcile');
        await reconcile();
      },
    },
    today: () => '2026-10-05',
    listen: () => {
      calls.push('listen');
    },
    log: vi.fn(),
  });

  it('reconciles before listening', async () => {
    const calls: string[] = [];
    await bootstrap(deps(async () => undefined, calls));
    expect(calls).toEqual(['reconcile', 'listen']);
  });

  it('passes the members and today to the reconcile', async () => {
    const reconcile = vi.fn(async () => undefined);
    const d = deps(async () => undefined, []);
    await bootstrap({ ...d, membershipService: { reconcile } });
    expect(reconcile).toHaveBeenCalledWith([{ id: 'm', disciplineIds: [BASKET], memberSince: '2020-01-01' }], '2026-10-05');
  });

  it('logs a failing reconcile and still listens', async () => {
    const calls: string[] = [];
    const d = deps(async () => {
      throw new Error('malformed memberships.json');
    }, calls);
    await bootstrap(d);
    expect(calls).toEqual(['reconcile', 'listen']);
    expect(d.log).toHaveBeenCalledWith(expect.stringContaining('reconcile'), expect.any(Error));
  });

  it('logs a failing members read and still listens', async () => {
    const calls: string[] = [];
    const d = deps(async () => undefined, calls);
    d.memberService.list = async () => {
      throw new Error('bad members file');
    };
    await bootstrap(d);
    expect(calls).toEqual(['listen']);
    expect(d.log).toHaveBeenCalled();
  });
});
