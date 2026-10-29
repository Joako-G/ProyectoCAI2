import { afterEach, describe, expect, it } from 'vitest';
import { ValidationError } from '../../src/shared/errors.js';
import { trackContexts } from './payment.helpers.js';

const contexts = trackContexts();
afterEach(() => contexts.cleanup());

const day20 = () => new Date('2026-10-20T15:00:00Z');

describe('enrollment preview (a member who does not exist yet)', () => {
  it('prices enrollment, the social fee and one activity fee per discipline, writing nothing', async () => {
    const { service, repository } = await contexts.create();
    const charge = await service.previewEnrollment(['basket', 'volley']);
    expect(charge.lines.map((line) => [line.kind, line.disciplineId ?? null])).toEqual([
      ['enrollment', null],
      ['socialFee', null],
      ['activityFee', 'basket'],
      ['activityFee', 'volley'],
    ]);
    expect(charge.total).toBe(80_000);
    expect(await repository.list()).toEqual([]);
  });

  it('halves each activity fee, never the social fee, when joining after the 15th', async () => {
    const { service } = await contexts.create({ now: day20 });
    const charge = await service.previewEnrollment(['basket']);
    expect(charge.total).toBe(50_000);
  });

  it('charges the same as the registration it announces, so the screen total is what gets collected', async () => {
    const { service } = await contexts.create({ now: day20 });
    const preview = await service.previewEnrollment(['basket']);
    const payment = await service.register(
      'member-lucia',
      {
        concepts: [{ kind: 'enrollment' }, { kind: 'socialFee', period: '2026-10' }, { kind: 'activityFee', period: '2026-10', disciplineId: 'basket' }],
        method: 'cash',
        registration: {},
      },
      'user-secretary',
    );
    expect(payment.total).toBe(preview.total);
  });

  it.each([
    ['an empty list', []],
    ['a repeated discipline', ['basket', 'basket']],
    ['a blank id', ['  ']],
    ['a non-text id', [42]],
    ['something that is not a list', 'basket'],
  ])('rejects %s', async (_label, disciplineIds) => {
    const { service } = await contexts.create();
    await expect(service.previewEnrollment(disciplineIds as unknown as string[])).rejects.toBeInstanceOf(ValidationError);
  });
});
