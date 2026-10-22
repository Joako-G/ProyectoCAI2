import { afterEach, describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError, ValidationError } from '../../src/shared/errors.js';
import { basketball, createTestContext, TODAY, volleyball } from './helpers.js';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()!();
});

async function setup() {
  const context = await createTestContext();
  cleanups.push(context.cleanup);
  return context;
}

async function fieldErrorsOf(promise: Promise<unknown>): Promise<Record<string, string>> {
  const error = await promise.then(
    () => undefined,
    (thrown: unknown) => thrown,
  );
  expect(error).toBeInstanceOf(ValidationError);
  return (error as ValidationError).fieldErrors;
}

describe('discipline service', () => {
  describe('create', () => {
    it('creates an active discipline with id and timestamp', async () => {
      const { service } = await setup();
      const discipline = await service.create(basketball);
      expect(discipline).toMatchObject({ ...basketball, status: 'active', createdAt: TODAY.toISOString() });
      expect(discipline.id).toBeTruthy();
      expect(discipline.deactivatedAt).toBeUndefined();
    });

    it('trims name and teacher name', async () => {
      const { service } = await setup();
      const discipline = await service.create({
        name: '  Patín artístico ',
        teachers: [' Lía Soria  ', ' Ana Gil'],
        leadTeacher: '  Ana Gil ',
      });
      expect(discipline).toMatchObject({
        name: 'Patín artístico',
        teachers: ['Lía Soria', 'Ana Gil'],
        leadTeacher: 'Ana Gil',
      });
    });

    it('requires name, teachers and lead teacher', async () => {
      const { service } = await setup();
      const errors = await fieldErrorsOf(service.create({ name: '  ', teachers: [], leadTeacher: '' }));
      expect(Object.keys(errors).sort()).toEqual(['leadTeacher', 'name', 'teachers']);
    });

    it('rejects non-string and missing values', async () => {
      const { service } = await setup();
      const errors = await fieldErrorsOf(service.create({ name: 5, teachers: 'Ana', leadTeacher: null } as never));
      expect(Object.keys(errors).sort()).toEqual(['leadTeacher', 'name', 'teachers']);
      await fieldErrorsOf(service.create(undefined as never));
    });

    it('rejects values over the maximum length', async () => {
      const { service } = await setup();
      const errors = await fieldErrorsOf(
        service.create({ name: 'x'.repeat(81), teachers: ['y'.repeat(101)], leadTeacher: 'y'.repeat(101) }),
      );
      expect(Object.keys(errors).sort()).toEqual(['name', 'teachers']);
    });

    it('requires at least one teacher and rejects blank entries', async () => {
      const { service } = await setup();
      for (const teachers of [[], ['  '], ['Ana Gil', ''], [5]]) {
        const errors = await fieldErrorsOf(service.create({ ...basketball, teachers, leadTeacher: 'Ana Gil' } as never));
        expect(errors.teachers).toBeTruthy();
      }
    });

    it('rejects repeated teachers ignoring case and accents', async () => {
      const { service } = await setup();
      const errors = await fieldErrorsOf(
        service.create({ ...basketball, teachers: ['Lía Soria', ' LIA soria '], leadTeacher: 'Lía Soria' }),
      );
      expect(errors.teachers).toBeTruthy();
      expect(errors.leadTeacher).toBeUndefined();
    });

    it('requires the lead teacher to be one of the teachers, comparing trimmed values', async () => {
      const { service } = await setup();
      const errors = await fieldErrorsOf(
        service.create({ ...basketball, teachers: ['Ana Gil', 'Lía Soria'], leadTeacher: 'Otra Persona' }),
      );
      expect(Object.keys(errors)).toEqual(['leadTeacher']);

      const stored = await service.create({
        ...basketball,
        teachers: ['Ana Gil', 'Lía Soria'],
        leadTeacher: '  Lía Soria ',
      });
      expect(stored.leadTeacher).toBe('Lía Soria');
    });

    it('rejects a duplicate name ignoring case and surrounding spaces', async () => {
      const { service } = await setup();
      await service.create(basketball);
      await expect(service.create({ ...volleyball, name: ' BÁSQUET ' })).rejects.toBeInstanceOf(
        ConflictError,
      );
      expect(await service.list()).toHaveLength(1);
    });

    it('folds accents like the search does when checking uniqueness', async () => {
      const { service } = await setup();
      await service.create({ name: 'Fútbol', teachers: ['Darío Paz'], leadTeacher: 'Darío Paz' });
      await expect(service.create({ ...volleyball, name: 'Futbol' })).rejects.toBeInstanceOf(
        ConflictError,
      );
      const other = await service.create({ name: 'Tenis', teachers: ['Ana Gil'], leadTeacher: 'Ana Gil' });
      await expect(service.update(other.id, { ...volleyball, name: 'FUTBOL' })).rejects.toBeInstanceOf(
        ConflictError,
      );
    });

    it('rejects a name that belongs to an inactive discipline', async () => {
      const { service } = await setup();
      const created = await service.create(basketball);
      await service.deactivate(created.id);
      await expect(service.create(basketball)).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('update', () => {
    it('replaces name and teachers and keeps identity and status', async () => {
      const { service } = await setup();
      const created = await service.create(basketball);
      const updated = await service.update(created.id, {
        name: 'Básquet mayor',
        teachers: ['Nuevo Docente', 'Marcos Ledesma'],
        leadTeacher: 'Nuevo Docente',
      });
      expect(updated).toMatchObject({
        id: created.id,
        name: 'Básquet mayor',
        teachers: ['Nuevo Docente', 'Marcos Ledesma'],
        leadTeacher: 'Nuevo Docente',
        status: 'active',
        createdAt: created.createdAt,
      });
      expect(await service.getById(created.id)).toEqual(updated);
    });

    it('allows keeping the own name with different casing', async () => {
      const { service } = await setup();
      const created = await service.create(basketball);
      const updated = await service.update(created.id, { ...basketball, name: 'básquet' });
      expect(updated.name).toBe('básquet');
    });

    it('rejects another discipline name', async () => {
      const { service } = await setup();
      await service.create(basketball);
      const other = await service.create(volleyball);
      await expect(service.update(other.id, { ...volleyball, name: 'básquet' })).rejects.toBeInstanceOf(
        ConflictError,
      );
    });

    it('validates input and reports unknown ids', async () => {
      const { service } = await setup();
      const created = await service.create(basketball);
      await fieldErrorsOf(service.update(created.id, { ...basketball, name: '' }));
      await expect(service.update('missing', volleyball)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('deactivate and reactivate', () => {
    it('deactivates with the club date and reactivates clearing it', async () => {
      const { service } = await setup();
      const created = await service.create(basketball);

      const inactive = await service.deactivate(created.id);
      expect(inactive).toMatchObject({ status: 'inactive', deactivatedAt: '2026-10-21' });

      const active = await service.reactivate(created.id);
      expect(active.status).toBe('active');
      expect(active.deactivatedAt).toBeUndefined();
    });

    it('rejects repeating a transition', async () => {
      const { service } = await setup();
      const created = await service.create(basketball);
      await expect(service.reactivate(created.id)).rejects.toBeInstanceOf(ConflictError);
      await service.deactivate(created.id);
      await expect(service.deactivate(created.id)).rejects.toBeInstanceOf(ConflictError);
    });

    it('reports unknown ids', async () => {
      const { service } = await setup();
      await expect(service.deactivate('missing')).rejects.toBeInstanceOf(NotFoundError);
      await expect(service.reactivate('missing')).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('read', () => {
    it('lists by name, filtered by status and accent-insensitive search', async () => {
      const { service } = await setup();
      await service.create(volleyball);
      const basket = await service.create(basketball);
      await service.deactivate(basket.id);

      expect((await service.list()).map((d) => d.name)).toEqual(['Básquet', 'Vóley']);
      expect((await service.list({ status: 'inactive' })).map((d) => d.name)).toEqual(['Básquet']);
      expect((await service.list({ status: 'active' })).map((d) => d.name)).toEqual(['Vóley']);
      expect((await service.list({ search: 'VOLEY' })).map((d) => d.name)).toEqual(['Vóley']);
      expect(await service.list({ search: 'zzz' })).toEqual([]);
    });

    it('gets by id and reports unknown ids', async () => {
      const { service } = await setup();
      const created = await service.create(basketball);
      expect(await service.getById(created.id)).toEqual(created);
      await expect(service.getById('missing')).rejects.toBeInstanceOf(NotFoundError);
    });

    it('finds many by id, skipping unknown ones', async () => {
      const { service } = await setup();
      const a = await service.create(basketball);
      const b = await service.create(volleyball);
      const found = await service.findByIds([b.id, 'missing', a.id]);
      expect(found.map((d) => d.id).sort()).toEqual([a.id, b.id].sort());
      expect(await service.findByIds([])).toEqual([]);
    });
  });
});
