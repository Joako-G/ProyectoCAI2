import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DisciplineRef } from '../../src/modules/members/discipline-lookup.js';
import { createJsonMemberRepository } from '../../src/modules/members/json-member.repository.js';
import { createMemberService } from '../../src/modules/members/member.service.js';
import { ValidationError } from '../../src/shared/errors.js';
import { adultInput, BASKET, fakeDisciplineLookup, RETIRED, TODAY, trackContexts, VOLLEY } from './helpers.js';
import { noAudit } from '../audit/helpers.js';

const contexts = trackContexts();
let ctx: Awaited<ReturnType<typeof contexts.create>>;

beforeEach(async () => {
  ctx = await contexts.create();
});

afterEach(() => contexts.cleanup());

async function fieldErrors(action: Promise<unknown>): Promise<Record<string, string>> {
  const error = await action.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ValidationError);
  return (error as ValidationError).fieldErrors;
}

describe('creating a member with disciplines', () => {
  it('stores the assigned discipline ids', async () => {
    const member = await ctx.service.create({ ...adultInput, disciplineIds: [BASKET, VOLLEY] }, 'user-test');
    expect(member.disciplineIds).toEqual([BASKET, VOLLEY]);
    expect((await ctx.service.getById(member.id)).disciplineIds).toEqual([BASKET, VOLLEY]);
  });

  it.each([
    ['missing', undefined],
    ['empty', []],
    ['not a list', BASKET],
  ])('rejects %s disciplineIds', async (_label, disciplineIds) => {
    const errors = await fieldErrors(ctx.service.create({ ...adultInput, disciplineIds: disciplineIds as never }, 'user-test'));
    expect(errors).toHaveProperty('disciplineIds');
  });

  it('rejects ids that are not non-empty strings', async () => {
    const errors = await fieldErrors(ctx.service.create({ ...adultInput, disciplineIds: [BASKET, 3, ' '] as never }, 'user-test'));
    expect(errors).toHaveProperty('disciplineIds');
  });

  it('rejects duplicate ids', async () => {
    const errors = await fieldErrors(ctx.service.create({ ...adultInput, disciplineIds: [BASKET, BASKET] }, 'user-test'));
    expect(errors.disciplineIds).toMatch(/more than once/i);
  });

  it('rejects unknown ids', async () => {
    const errors = await fieldErrors(ctx.service.create({ ...adultInput, disciplineIds: [BASKET, 'nope'] }, 'user-test'));
    expect(errors.disciplineIds).toMatch(/unknown/i);
    expect(errors.disciplineIds).toContain('nope');
  });

  it('rejects inactive disciplines on create', async () => {
    const errors = await fieldErrors(ctx.service.create({ ...adultInput, disciplineIds: [RETIRED] }, 'user-test'));
    expect(errors.disciplineIds).toMatch(/inactive/i);
  });

  it('reports other field errors together with discipline shape errors', async () => {
    const errors = await fieldErrors(ctx.service.create({ ...adultInput, firstName: '', disciplineIds: [] }, 'user-test'));
    expect(Object.keys(errors).sort()).toEqual(['disciplineIds', 'firstName']);
  });
});

describe('updating a member disciplines', () => {
  it('replaces the assigned disciplines', async () => {
    const created = await ctx.service.create(adultInput, 'user-test');
    const updated = await ctx.service.update(created.id, { ...adultInput, disciplineIds: [VOLLEY, BASKET] }, 'user-test');
    expect(updated.disciplineIds).toEqual([VOLLEY, BASKET]);
  });

  it('requires at least one discipline', async () => {
    const created = await ctx.service.create(adultInput, 'user-test');
    const errors = await fieldErrors(ctx.service.update(created.id, { ...adultInput, disciplineIds: [] }, 'user-test'));
    expect(errors).toHaveProperty('disciplineIds');
  });

  it('rejects newly added inactive disciplines', async () => {
    const created = await ctx.service.create(adultInput, 'user-test');
    const errors = await fieldErrors(ctx.service.update(created.id, { ...adultInput, disciplineIds: [BASKET, RETIRED] }, 'user-test'));
    expect(errors.disciplineIds).toMatch(/inactive/i);
  });

  it('keeps an already assigned discipline that was deactivated later', async () => {
    const statuses: DisciplineRef[] = [
      { id: BASKET, status: 'active' },
      { id: RETIRED, status: 'active' },
    ];
    const local = await contexts.create(undefined, {
      findByIds: async (ids) => statuses.filter((d) => ids.includes(d.id)),
    });
    const created = await local.service.create({ ...adultInput, disciplineIds: [BASKET, RETIRED] }, 'user-test');
    statuses[1]!.status = 'inactive';

    const updated = await local.service.update(created.id, { ...adultInput, firstName: 'Lu', disciplineIds: [RETIRED] }, 'user-test');

    expect(updated.disciplineIds).toEqual([RETIRED]);
    const other = await local.service.create({ ...adultInput, dni: '30999000', disciplineIds: [BASKET] }, 'user-test');
    const errors = await fieldErrors(local.service.update(other.id, { ...adultInput, dni: '30999000', disciplineIds: [RETIRED] }, 'user-test'));
    expect(errors.disciplineIds).toMatch(/inactive/i);
  });

  it('still rejects unknown ids that were never assigned', async () => {
    const created = await ctx.service.create(adultInput, 'user-test');
    const errors = await fieldErrors(ctx.service.update(created.id, { ...adultInput, disciplineIds: ['nope'] }, 'user-test'));
    expect(errors.disciplineIds).toMatch(/unknown/i);
  });

  it('keeps the disciplines through deactivate and reactivate', async () => {
    const created = await ctx.service.create({ ...adultInput, disciplineIds: [BASKET, VOLLEY] }, 'user-test');
    await ctx.service.deactivate(created.id, 'Moved away', 'user-test');
    expect((await ctx.service.reactivate(created.id, 'user-test')).disciplineIds).toEqual([BASKET, VOLLEY]);
  });
});

describe('legacy members without disciplineIds', () => {
  async function legacyService() {
    const dir = await mkdtemp(join(tmpdir(), 'members-legacy-'));
    const file = join(dir, 'members.json');
    const { disciplineIds: _ids, ...legacy } = adultInput;
    await writeFile(
      file,
      JSON.stringify([{ ...legacy, id: 'old', memberNumber: '0001', status: 'active', createdAt: 'x', updatedAt: 'x' }]),
    );
    const service = createMemberService({
      audit: noAudit,
      repository: createJsonMemberRepository(file),
      now: () => TODAY,
      disciplineLookup: fakeDisciplineLookup(),
    });
    return { service, cleanup: () => rm(dir, { recursive: true, force: true }) };
  }

  it('reads them with an empty list in get and list', async () => {
    const { service, cleanup } = await legacyService();
    expect((await service.getById('old')).disciplineIds).toEqual([]);
    expect((await service.list()).map((m) => m.disciplineIds)).toEqual([[]]);
    await cleanup();
  });

  it('requires choosing a discipline to edit them', async () => {
    const { service, cleanup } = await legacyService();
    const errors = await fieldErrors(service.update('old', { ...adultInput, disciplineIds: [] }, 'user-test'));
    expect(errors).toHaveProperty('disciplineIds');
    expect((await service.update('old', adultInput, 'user-test')).disciplineIds).toEqual([BASKET]);
    await cleanup();
  });
});

describe('listing by discipline', () => {
  async function seeded() {
    await ctx.service.create({ ...adultInput, dni: '30111111', disciplineIds: [BASKET] }, 'user-test');
    await ctx.service.create({ ...adultInput, firstName: 'Ana', dni: '30222222', disciplineIds: [BASKET, VOLLEY] }, 'user-test');
    const inactive = await ctx.service.create({ ...adultInput, firstName: 'Bruno', dni: '30333333', disciplineIds: [VOLLEY] }, 'user-test');
    await ctx.service.deactivate(inactive.id, 'Moved away', 'user-test');
  }
  const names = async (query: Parameters<typeof ctx.service.list>[0]) =>
    (await ctx.service.list(query)).map((m) => m.firstName).sort();

  it('filters by discipline id', async () => {
    await seeded();
    expect(await names({ disciplineId: VOLLEY })).toEqual(['Ana', 'Bruno']);
    expect(await names({ disciplineId: BASKET })).toEqual(['Ana', 'Lucía']);
    expect(await names({ disciplineId: 'nope' })).toEqual([]);
  });

  it('combines with search and status', async () => {
    await seeded();
    expect(await names({ disciplineId: VOLLEY, status: 'active' })).toEqual(['Ana']);
    expect(await names({ disciplineId: BASKET, search: 'ana' })).toEqual(['Ana']);
    expect(await names({ disciplineId: VOLLEY, search: 'lucia' })).toEqual([]);
  });
});
