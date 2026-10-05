import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError, ValidationError } from '../../src/shared/errors.js';
import { adultInput, createTestContext, minorInput, TODAY } from './helpers.js';

let ctx: Awaited<ReturnType<typeof createTestContext>>;

beforeEach(async () => {
  ctx = await createTestContext();
});

afterEach(() => ctx.cleanup());

async function fieldErrors(action: Promise<unknown>): Promise<Record<string, string>> {
  const error = await action.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ValidationError);
  return (error as ValidationError).fieldErrors;
}

describe('create', () => {
  it('creates an active member with generated id, normalized fields and timestamps', async () => {
    const member = await ctx.service.create({ ...adultInput, firstName: '  Lucía ', email: 'lucia@example.com' });

    expect(member).toMatchObject({
      memberNumber: '0001',
      firstName: 'Lucía',
      lastName: 'Ríos',
      dni: '30123456',
      whatsapp: '+5491155551234',
      email: 'lucia@example.com',
      status: 'active',
    });
    expect(member.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(member.createdAt).toBe(TODAY.toISOString());
    expect(member.updatedAt).toBe(member.createdAt);
    expect(member.deactivation).toBeUndefined();
    expect(member).not.toHaveProperty('age');
  });

  it('persists the member so getById returns it', async () => {
    const created = await ctx.service.create(adultInput);

    expect(await ctx.service.getById(created.id)).toEqual(created);
  });

  it('assigns sequential zero-padded member numbers', async () => {
    const first = await ctx.service.create(adultInput);
    const second = await ctx.service.create({ ...minorInput });

    expect([first.memberNumber, second.memberNumber]).toEqual(['0001', '0002']);
  });

  it('never reuses a member number, even for inactive members', async () => {
    const first = await ctx.service.create(adultInput);
    await ctx.service.deactivate(first.id, 'Moved away');
    const second = await ctx.service.create({ ...minorInput });

    expect(second.memberNumber).toBe('0002');
  });

  it('collects every field error at once', async () => {
    const errors = await fieldErrors(
      ctx.service.create({
        firstName: ' ',
        lastName: '',
        dni: '12',
        birthDate: '2020-02-30',
        category: 'Junior' as never,
        memberSince: 'yesterday',
        whatsapp: 'abc',
        email: 'not-an-email',
      }),
    );

    expect(Object.keys(errors).sort()).toEqual([
      'birthDate',
      'category',
      'dni',
      'email',
      'firstName',
      'lastName',
      'memberSince',
      'whatsapp',
    ]);
  });

  it('rejects non-object input and non-string fields', async () => {
    const errors = await fieldErrors(ctx.service.create({ ...adultInput, firstName: 42 as never }));

    expect(errors).toHaveProperty('firstName');
    await expect(ctx.service.create(null as never)).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects a birth date in the future', async () => {
    const errors = await fieldErrors(ctx.service.create({ ...adultInput, birthDate: '2026-10-06' }));

    expect(errors).toHaveProperty('birthDate');
  });

  it('rejects a member-since date in the future or before the birth date', async () => {
    const future = await fieldErrors(ctx.service.create({ ...adultInput, memberSince: '2026-10-06' }));
    const early = await fieldErrors(ctx.service.create({ ...adultInput, memberSince: '1989-01-01' }));

    expect(future).toHaveProperty('memberSince');
    expect(early).toHaveProperty('memberSince');
  });

  it('accepts a member-since date equal to today', async () => {
    const member = await ctx.service.create({ ...adultInput, memberSince: '2026-10-05' });

    expect(member.memberSince).toBe('2026-10-05');
  });

  it('only accepts real calendar dates', async () => {
    const leap = await ctx.service.create({ ...adultInput, birthDate: '2000-02-29' });
    const errors = await fieldErrors(ctx.service.create({ ...adultInput, dni: '30999888', birthDate: '2001-02-29' }));

    expect(leap.birthDate).toBe('2000-02-29');
    expect(errors).toHaveProperty('birthDate');
  });

  describe('dni', () => {
    it.each(['30.123.456', '30 123 456', '30123456'])('normalizes %s to digits only', async (dni) => {
      const member = await ctx.service.create({ ...adultInput, dni });

      expect(member.dni).toBe('30123456');
    });

    it.each(['1234567', '12345678'])('accepts %s digits', async (dni) => {
      expect((await ctx.service.create({ ...adultInput, dni })).dni).toBe(dni);
    });

    it.each(['123456', '123456789', '12a45678', ''])('rejects %j', async (dni) => {
      expect(await fieldErrors(ctx.service.create({ ...adultInput, dni }))).toHaveProperty('dni');
    });

    it('rejects a duplicate dni regardless of formatting', async () => {
      await ctx.service.create(adultInput);

      await expect(ctx.service.create({ ...minorInput, dni: '30 123 456' })).rejects.toBeInstanceOf(ConflictError);
    });

    it('rejects a dni that belongs to an inactive member', async () => {
      const first = await ctx.service.create(adultInput);
      await ctx.service.deactivate(first.id, 'Left the club');

      await expect(ctx.service.create({ ...minorInput, dni: first.dni })).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('whatsapp', () => {
    it.each([
      ['(011) 5555-1234', '01155551234'],
      ['+54 9 11 5555 1234', '+5491155551234'],
    ])('normalizes %s', async (input, expected) => {
      expect((await ctx.service.create({ ...adultInput, whatsapp: input })).whatsapp).toBe(expected);
    });

    it.each(['1234567', '1234567890123456', '12-ab-5678', ''])('rejects %j', async (whatsapp) => {
      expect(await fieldErrors(ctx.service.create({ ...adultInput, whatsapp }))).toHaveProperty('whatsapp');
    });
  });

  describe('email', () => {
    it('is optional and empty values are dropped', async () => {
      const member = await ctx.service.create({ ...adultInput, email: '  ' });

      expect(member).not.toHaveProperty('email');
    });
  });

  describe('guardian', () => {
    it('is required for minors', async () => {
      const { guardian: _guardian, ...withoutGuardian } = minorInput;

      const errors = await fieldErrors(ctx.service.create(withoutGuardian));

      expect(Object.keys(errors).sort()).toEqual(['guardian.contact', 'guardian.name']);
    });

    it('requires the guardian contact to be a valid phone', async () => {
      const errors = await fieldErrors(
        ctx.service.create({ ...minorInput, guardian: { name: 'Ana', contact: 'call me' } }),
      );

      expect(Object.keys(errors)).toEqual(['guardian.contact']);
    });

    it('stores a normalized guardian for minors', async () => {
      const member = await ctx.service.create({
        ...minorInput,
        guardian: { name: ' Ana Gómez ', contact: '11 5555-2222' },
      });

      expect(member.guardian).toEqual({ name: 'Ana Gómez', contact: '1155552222' });
    });

    it('is optional for adults and dropped when empty', async () => {
      const member = await ctx.service.create({ ...adultInput, guardian: { name: '', contact: ' ' } });

      expect(member).not.toHaveProperty('guardian');
    });

    it('validates a partially filled guardian for adults', async () => {
      const errors = await fieldErrors(ctx.service.create({ ...adultInput, guardian: { name: 'Ana', contact: '' } }));

      expect(Object.keys(errors)).toEqual(['guardian.contact']);
    });
  });

  describe('minor boundary', () => {
    it('is a minor the day before the 18th birthday', async () => {
      const dayBefore = await createTestContext(() => new Date(2026, 9, 4, 12));
      const { guardian: _guardian, ...input } = minorInput;

      const errors = await fieldErrors(dayBefore.service.create({ ...input, birthDate: '2008-10-05', memberSince: '2020-01-01' }));
      await dayBefore.cleanup();

      expect(errors).toHaveProperty('guardian.name');
    });

    it('is an adult on the 18th birthday', async () => {
      const { guardian: _guardian, ...input } = minorInput;

      const member = await ctx.service.create({ ...input, birthDate: '2008-10-05', memberSince: '2020-01-01' });

      expect(member).not.toHaveProperty('guardian');
    });

    it('is a minor one day before the 18th birthday on the current date', async () => {
      const { guardian: _guardian, ...input } = minorInput;

      const errors = await fieldErrors(ctx.service.create({ ...input, birthDate: '2008-10-06', memberSince: '2020-01-01' }));

      expect(errors).toHaveProperty('guardian.name');
    });
  });
});

describe('update', () => {
  it('changes personal fields and keeps identity, number, status and createdAt', async () => {
    const clock = { value: TODAY };
    const local = await createTestContext(() => clock.value);
    const created = await local.service.create(adultInput);
    clock.value = new Date(2026, 9, 6, 12);

    const updated = await local.service.update(created.id, { ...adultInput, lastName: 'Rios Pérez', dni: '31000111' });
    await local.cleanup();

    expect(updated).toMatchObject({
      id: created.id,
      memberNumber: '0001',
      lastName: 'Rios Pérez',
      dni: '31000111',
      status: 'active',
      createdAt: created.createdAt,
      updatedAt: clock.value.toISOString(),
    });
  });

  it('ignores attempts to change protected fields', async () => {
    const created = await ctx.service.create(adultInput);

    const updated = await ctx.service.update(created.id, {
      ...adultInput,
      memberNumber: '9999',
      status: 'inactive',
      id: 'other',
    } as never);

    expect(updated).toMatchObject({ id: created.id, memberNumber: '0001', status: 'active' });
  });

  it('allows keeping the same dni', async () => {
    const created = await ctx.service.create(adultInput);

    const updated = await ctx.service.update(created.id, { ...adultInput, firstName: 'Lu' });

    expect(updated.firstName).toBe('Lu');
  });

  it('rejects the dni of another member, including inactive ones', async () => {
    const first = await ctx.service.create(adultInput);
    const second = await ctx.service.create(minorInput);
    await ctx.service.deactivate(first.id, 'Left');

    await expect(ctx.service.update(second.id, { ...minorInput, dni: first.dni })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it('validates the input', async () => {
    const created = await ctx.service.create(adultInput);

    expect(await fieldErrors(ctx.service.update(created.id, { ...adultInput, firstName: '' }))).toHaveProperty(
      'firstName',
    );
  });

  it('fails with NotFoundError for an unknown id', async () => {
    await expect(ctx.service.update('missing', adultInput)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('can edit an inactive member without reactivating it', async () => {
    const created = await ctx.service.create(adultInput);
    await ctx.service.deactivate(created.id, 'Left');

    const updated = await ctx.service.update(created.id, { ...adultInput, firstName: 'Lu' });

    expect(updated.status).toBe('inactive');
    expect(updated.deactivation).toBeDefined();
  });
});

describe('deactivate and reactivate', () => {
  it('deactivates with today as date and a trimmed reason', async () => {
    const created = await ctx.service.create(adultInput);

    const inactive = await ctx.service.deactivate(created.id, '  Moved abroad ');

    expect(inactive.status).toBe('inactive');
    expect(inactive.deactivation).toEqual({ date: '2026-10-05', reason: 'Moved abroad' });
    expect((await ctx.service.getById(created.id)).status).toBe('inactive');
  });

  it('requires a non-empty reason', async () => {
    const created = await ctx.service.create(adultInput);

    expect(await fieldErrors(ctx.service.deactivate(created.id, '   '))).toHaveProperty('reason');
    expect((await ctx.service.getById(created.id)).status).toBe('active');
  });

  it('fails with ConflictError when already inactive', async () => {
    const created = await ctx.service.create(adultInput);
    await ctx.service.deactivate(created.id, 'Left');

    await expect(ctx.service.deactivate(created.id, 'Again')).rejects.toBeInstanceOf(ConflictError);
  });

  it('fails with NotFoundError for an unknown id', async () => {
    await expect(ctx.service.deactivate('missing', 'Left')).rejects.toBeInstanceOf(NotFoundError);
    await expect(ctx.service.reactivate('missing')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('reactivates and removes the deactivation data', async () => {
    const created = await ctx.service.create(adultInput);
    await ctx.service.deactivate(created.id, 'Left');

    const active = await ctx.service.reactivate(created.id);

    expect(active.status).toBe('active');
    expect(active).not.toHaveProperty('deactivation');
    expect(await ctx.service.getById(created.id)).toEqual(active);
  });

  it('fails with ConflictError when already active', async () => {
    const created = await ctx.service.create(adultInput);

    await expect(ctx.service.reactivate(created.id)).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('getById', () => {
  it('fails with NotFoundError for an unknown id', async () => {
    await expect(ctx.service.getById('missing')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('list', () => {
  beforeEach(async () => {
    await ctx.service.create({ ...adultInput, firstName: 'Lucía', lastName: 'Ríos', dni: '30111111' });
    await ctx.service.create({ ...adultInput, firstName: 'Ana', lastName: 'Ríos', dni: '30222222' });
    const third = await ctx.service.create({ ...adultInput, firstName: 'Bruno', lastName: 'Álvarez', dni: '30333333' });
    await ctx.service.deactivate(third.id, 'Left');
  });

  const names = async (query?: Parameters<typeof ctx.service.list>[0]) =>
    (await ctx.service.list(query)).map((m) => `${m.lastName} ${m.firstName}`);

  it('sorts by last name then first name, accent-insensitively', async () => {
    expect(await names()).toEqual(['Álvarez Bruno', 'Ríos Ana', 'Ríos Lucía']);
  });

  it('filters by status', async () => {
    expect(await names({ status: 'inactive' })).toEqual(['Álvarez Bruno']);
    expect(await names({ status: 'active' })).toEqual(['Ríos Ana', 'Ríos Lucía']);
  });

  it('searches case- and accent-insensitively', async () => {
    expect(await names({ search: 'rios' })).toEqual(['Ríos Ana', 'Ríos Lucía']);
    expect(await names({ search: 'LUCIA' })).toEqual(['Ríos Lucía']);
    expect(await names({ search: 'alvarez' })).toEqual(['Álvarez Bruno']);
  });

  it('searches the full name in both orders', async () => {
    expect(await names({ search: 'ana rios' })).toEqual(['Ríos Ana']);
    expect(await names({ search: 'rios ana' })).toEqual(['Ríos Ana']);
  });

  it('searches by dni digits, ignoring dots', async () => {
    expect(await names({ search: '30.222' })).toEqual(['Ríos Ana']);
    expect(await names({ search: '333' })).toEqual(['Álvarez Bruno']);
  });

  it('combines search and status', async () => {
    expect(await names({ search: 'rios', status: 'inactive' })).toEqual([]);
  });

  it('treats a blank search as no search', async () => {
    expect(await names({ search: '  ' })).toHaveLength(3);
  });
});

describe('concurrency', () => {
  it('gives distinct member numbers to concurrent creates', async () => {
    const inputs = Array.from({ length: 10 }, (_, i) => ({ ...adultInput, dni: `3000000${i}` }));

    const members = await Promise.all(inputs.map((input) => ctx.service.create(input)));

    expect(new Set(members.map((m) => m.memberNumber)).size).toBe(10);
    expect((await ctx.service.list()).length).toBe(10);
  });

  it('lets only one of two concurrent creates with the same dni succeed', async () => {
    const results = await Promise.allSettled([ctx.service.create(adultInput), ctx.service.create(adultInput)]);

    expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect((results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason).toBeInstanceOf(
      ConflictError,
    );
    expect(await ctx.service.list()).toHaveLength(1);
  });
});
