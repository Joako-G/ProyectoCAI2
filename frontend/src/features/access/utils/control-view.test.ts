import { describe, expect, it } from 'vitest';
import type { GreetingEvent } from '../types/greeting';
import { buildControlBanner, buildMemberCard, formatDni, WAITING_BANNER } from './control-view';

const member = { id: 'm1', memberNumber: '1042', fullName: 'Valentina Ríos', firstName: 'Valentina', disciplines: ['Natación', 'Gimnasia'] };

function event(overrides: Partial<GreetingEvent> = {}): GreetingEvent {
  // 15:42 UTC is 12:42 in the club time zone.
  return { at: '2026-11-08T15:42:00.000Z', tone: 'welcome', kind: 'up_to_date', method: 'face', firstName: 'Valentina', member, ...overrides };
}

describe('buildControlBanner', () => {
  it('waits for the first control with a neutral banner and no method', () => {
    expect(buildControlBanner(undefined)).toEqual(WAITING_BANNER);
    expect(WAITING_BANNER).toMatchObject({ tone: 'neutral', title: 'Esperando el primer control' });
    expect(WAITING_BANNER.method).toBeUndefined();
  });

  it('up to date: green, "Acceso autorizado" and the due date', () => {
    expect(buildControlBanner(event({ dueDate: '2027-01-10', paidThrough: '2026-12' }))).toEqual({
      tone: 'green', title: 'Acceso autorizado', detail: 'La cuota vence el 10/01/2027.', method: 'Cámara', time: '12:42',
    });
  });

  it('up to date without a due date falls back to the paid month, then to a plain line', () => {
    expect(buildControlBanner(event({ paidThrough: '2026-12' })).detail).toBe('Cuota paga hasta diciembre 2026.');
    expect(buildControlBanner(event()).detail).toBe('Cuota al día.');
  });

  it('debtor: amber, "avisar" and the month of the debt', () => {
    expect(buildControlBanner(event({ tone: 'see_desk', kind: 'debtor', method: 'dni', debtSince: '2026-08' }))).toEqual({
      tone: 'amber', title: 'Acceso autorizado · avisar', detail: 'Tiene cuotas pendientes desde agosto 2026.', method: 'DNI', time: '12:42',
    });
  });

  it('deregistered: red, not enabled, sent to the cash desk', () => {
    expect(buildControlBanner(event({ tone: 'see_desk', kind: 'deregistered', debtSince: '2026-01' }))).toMatchObject({
      tone: 'red', title: 'Acceso no habilitado', detail: 'Tiene cuotas pendientes desde enero 2026. Debe pasar por caja.',
    });
  });

  it('inactive: gray', () => {
    expect(buildControlBanner(event({ tone: 'refused', kind: 'inactive' }))).toMatchObject({
      tone: 'gray', title: 'Socio inactivo', detail: 'La ficha figura inactiva.',
    });
  });

  it('not recognized by face and DNI not found: gray "No reconocido", each with its own advice', () => {
    expect(buildControlBanner(event({ tone: 'refused', kind: 'not_recognized', member: undefined }))).toMatchObject({
      tone: 'gray', title: 'No reconocido', detail: 'La cámara no encontró coincidencia. Ingresá el DNI del socio.', method: 'Cámara',
    });
    expect(buildControlBanner(event({ tone: 'refused', kind: 'not_found', method: 'dni', member: undefined }))).toMatchObject({
      tone: 'gray', title: 'No reconocido', detail: 'Ese DNI no está registrado.', method: 'DNI',
    });
  });
});

describe('buildMemberCard', () => {
  const details = { dni: '30123456', age: 14, category: 'Cadete', memberSince: '2021-03-15', lastPayment: '2026-11-04' };

  it('is absent when nobody was identified', () => {
    expect(buildMemberCard(event({ kind: 'not_recognized', member: undefined }), {})).toBeUndefined();
  });

  it('shows the identity, the facts and the discipline names of an up to date member', () => {
    expect(buildMemberCard(event({ dueDate: '2027-01-10' }), details)).toEqual({
      name: 'Valentina Ríos',
      initials: 'VR',
      number: '1042',
      subtitle: '14 años · Cadete · Socio desde 03/2021',
      facts: [
        { label: 'DNI', value: '30.123.456' },
        { label: 'CUOTA VENCE', value: '10/01/2027' },
        { label: 'ESTADO DE CUENTA', value: 'Al día' },
        { label: 'ÚLTIMO PAGO', value: '04/11/2026' },
      ],
      disciplines: ['Natación', 'Gimnasia'],
    });
  });

  it('a debtor shows "Debe desde" in place of the due date, and Pendiente', () => {
    const card = buildMemberCard(event({ kind: 'debtor', tone: 'see_desk', debtSince: '2026-08' }), details);
    expect(card?.facts.map((fact) => fact.value)).toEqual(['30.123.456', 'Debe desde agosto 2026', 'Pendiente', '04/11/2026']);
  });

  it('maps the account state of deregistered and inactive members', () => {
    expect(buildMemberCard(event({ kind: 'deregistered', tone: 'see_desk', debtSince: '2026-01' }), details)?.facts[2]?.value).toBe('Vencida');
    const inactive = buildMemberCard(event({ kind: 'inactive', tone: 'refused' }), details);
    expect(inactive?.facts[1]?.value).toBe('—');
    expect(inactive?.facts[2]?.value).toBe('Inactivo');
  });

  it('shows a dash for everything the extra loads did not bring, and never blocks on them', () => {
    const card = buildMemberCard(event({ dueDate: '2027-01-10' }), {});
    expect(card?.subtitle).toBe('—');
    expect(card?.facts.map((fact) => fact.value)).toEqual(['—', '10/01/2027', 'Al día', '—']);
    expect(card?.name).toBe('Valentina Ríos');
  });

  it('says "1 año" in the singular and leaves out the pieces that are missing', () => {
    expect(buildMemberCard(event(), { age: 1, category: 'Infantil' })?.subtitle).toBe('1 año · Infantil');
  });

  it('shows no weekly attendance and no days or counts in the disciplines', () => {
    const card = buildMemberCard(event(), details);
    expect(card?.facts.map((fact) => fact.label)).not.toContain('ASISTENCIAS / SEMANA');
    expect(card?.disciplines).toEqual(['Natación', 'Gimnasia']);
  });
});

describe('formatDni', () => {
  it('groups the digits like the mockup', () => {
    expect(formatDni('57201998')).toBe('57.201.998');
    expect(formatDni('1234567')).toBe('1.234.567');
    expect(formatDni('')).toBe('—');
  });
});
