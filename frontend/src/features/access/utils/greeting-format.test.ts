import { describe, expect, it } from 'vitest';
import { parseGreeting } from './greeting-format';

describe('parseGreeting', () => {
  it('keeps only the known fields: the tone, the time, the first name and the entrance detail', () => {
    const event = parseGreeting(JSON.stringify({ at: '2026-11-07T15:00:00.000Z', tone: 'welcome', firstName: 'Lucía', kind: 'up_to_date', method: 'dni', dni: '30111222', amount: 20000, reason: 'x' }));
    expect(event).toEqual({ at: '2026-11-07T15:00:00.000Z', tone: 'welcome', firstName: 'Lucía', kind: 'up_to_date', method: 'dni' });
  });

  const identified = { id: 'm1', memberNumber: '0101', fullName: 'Lucía Prueba', firstName: 'Lucía', disciplines: ['Básquet', 'Natación'], dni: '30111222' };

  it('keeps the kind, the method and the identified member, and drops unknown member fields', () => {
    const event = parseGreeting(
      JSON.stringify({ at: 'x', tone: 'welcome', firstName: 'Lucía', kind: 'up_to_date', method: 'face', member: identified, paidThrough: '2026-12', dueDate: '2027-01-10', unpaidPeriodCount: 0, descriptor: [0.1] }),
    );
    expect(event).toEqual({
      at: 'x',
      tone: 'welcome',
      firstName: 'Lucía',
      kind: 'up_to_date',
      method: 'face',
      member: { id: 'm1', memberNumber: '0101', fullName: 'Lucía Prueba', firstName: 'Lucía', disciplines: ['Básquet', 'Natación'] },
      paidThrough: '2026-12',
      dueDate: '2027-01-10',
      unpaidPeriodCount: 0,
    });
  });

  it('keeps the debt month of a debtor, and the member of a refused identified check', () => {
    const event = parseGreeting(JSON.stringify({ at: 'x', tone: 'refused', kind: 'deregistered', method: 'dni', member: identified, debtSince: '2026-06', unpaidPeriodCount: 5 }));
    expect(event).toMatchObject({ tone: 'refused', kind: 'deregistered', method: 'dni', debtSince: '2026-06', unpaidPeriodCount: 5, member: { id: 'm1' } });
  });

  it('drops an optional field with the wrong shape instead of trusting it', () => {
    const event = parseGreeting(
      JSON.stringify({ at: 'x', tone: 'see_desk', firstName: 'Lucía', kind: 'debtor', method: 'face', member: { ...identified, id: 7 }, paidThrough: '2026-13', dueDate: 'soon', debtSince: '06/2026', unpaidPeriodCount: -1 }),
    );
    expect(event).toEqual({ at: 'x', tone: 'see_desk', firstName: 'Lucía', kind: 'debtor', method: 'face' });
  });

  it('requires a valid kind and method: a message without them is not a greeting', () => {
    const base = { at: 'x', tone: 'welcome', firstName: 'Lucía' };
    expect(parseGreeting(JSON.stringify(base))).toBeUndefined();
    expect(parseGreeting(JSON.stringify({ ...base, kind: 'up_to_date' }))).toBeUndefined();
    expect(parseGreeting(JSON.stringify({ ...base, method: 'dni' }))).toBeUndefined();
    expect(parseGreeting(JSON.stringify({ ...base, kind: 'party', method: 'dni' }))).toBeUndefined();
    expect(parseGreeting(JSON.stringify({ ...base, kind: 'up_to_date', method: 'telepathy' }))).toBeUndefined();
  });

  it('keeps only the string discipline names', () => {
    const event = parseGreeting(JSON.stringify({ at: 'x', tone: 'welcome', kind: 'up_to_date', method: 'dni', member: { ...identified, disciplines: ['Básquet', 3, null, '  '] } }));
    expect(event?.member?.disciplines).toEqual(['Básquet']);
    const broken = parseGreeting(JSON.stringify({ at: 'x', tone: 'welcome', kind: 'up_to_date', method: 'dni', member: { ...identified, disciplines: 'Básquet' } }));
    expect(broken?.member?.disciplines).toEqual([]);
  });

  it('never keeps member data on a check that identified nobody', () => {
    for (const kind of ['not_recognized', 'not_found']) {
      const event = parseGreeting(JSON.stringify({ at: 'x', tone: 'refused', kind, method: 'face', member: identified, debtSince: '2026-06', unpaidPeriodCount: 2, firstName: 'Lucía' }));
      expect(event, kind).toEqual({ at: 'x', tone: 'refused', kind, method: 'face' });
    }
  });

  it('drops a name from a refusal', () => {
    expect(parseGreeting(JSON.stringify({ at: 'x', tone: 'refused', kind: 'inactive', method: 'dni', firstName: 'Lucía' }))).toEqual({ at: 'x', tone: 'refused', kind: 'inactive', method: 'dni' });
  });

  it('rejects anything that is not a greeting', () => {
    for (const raw of ['', 'nope', '[]', 'null', '{"tone":"party"}', '{"tone":"welcome","firstName":42,"kind":"up_to_date","method":"dni"}']) {
      expect(parseGreeting(raw), raw).toBeUndefined();
    }
  });
});
