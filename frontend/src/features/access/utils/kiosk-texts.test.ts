import { describe, expect, it } from 'vitest';
import type { GreetingEvent } from '../types/greeting';
import { buildResultView, initialsOf, KIOSK_TEXT } from './kiosk-texts';

const member = { id: 'm1', memberNumber: '1042', fullName: 'Valentina Ríos', firstName: 'Valentina', disciplines: [] as string[] };

function event(overrides: Partial<GreetingEvent>): GreetingEvent {
  return { at: '2026-11-08T15:00:00.000Z', tone: 'welcome', kind: 'up_to_date', method: 'face', firstName: 'Valentina', member, ...overrides };
}

describe('buildResultView', () => {
  it('up to date: green, the paid month in Spanish, the next due date', () => {
    const view = buildResultView(event({ paidThrough: '2026-08', dueDate: '2026-09-10' }));
    expect(view).toMatchObject({
      tone: 'green',
      frameLabel: 'ROSTRO IDENTIFICADO',
      icon: '✓',
      label: 'ACCESO AUTORIZADO',
      title: 'Pasá, Valentina',
      message: 'Tu cuota está paga hasta agosto 2026.',
      detail: { label: 'Próximo vencimiento', value: '10/09/2026' },
      footer: 'ACCESO REGISTRADO · PUERTA PRINCIPAL',
      member: { name: 'Valentina Ríos', number: '1042', fee: 'AL DÍA', initials: 'VR' },
    });
  });

  it('adds the disciplines to the message, only when there are some', () => {
    const view = buildResultView(event({ paidThrough: '2026-12', member: { ...member, disciplines: ['Natación', 'Básquet'] } }));
    expect(view.message).toBe('Tu cuota está paga hasta diciembre 2026. Disciplinas: Natación, Básquet.');
  });

  it('up to date without a due date has no detail row, and without a paid month still says it is up to date', () => {
    const view = buildResultView(event({}));
    expect(view.detail).toBeUndefined();
    expect(view.message).toBe('Tu cuota está al día.');
  });

  it('debtor: amber, may enter, asks to pass by the desk, with no amount and no count of months', () => {
    const view = buildResultView(event({ tone: 'see_desk', kind: 'debtor', debtSince: '2026-06', unpaidPeriodCount: 5 }));
    expect(view).toMatchObject({
      tone: 'amber',
      label: 'ACCESO AUTORIZADO · AVISO',
      icon: '!',
      title: 'Pasá, Valentina',
      message: 'Hola, Valentina Ríos. Tenés cuotas pendientes desde junio 2026. Pasá por secretaría.',
      member: { fee: 'PENDIENTE' },
      footer: 'ACCESO REGISTRADO · PUERTA PRINCIPAL',
    });
    expect(view.detail).toBeUndefined();
    expect(JSON.stringify(view)).not.toMatch(/\b5\b|\$/);
  });

  it('deregistered: red, asks to go to the desk with the same message as a debtor', () => {
    const view = buildResultView(event({ tone: 'refused', kind: 'deregistered', debtSince: '2026-01' }));
    expect(view).toMatchObject({
      tone: 'red',
      label: 'ACCESO NO HABILITADO',
      icon: '×',
      title: 'Valentina, pasá por secretaría',
      message: 'Hola, Valentina Ríos. Tenés cuotas pendientes desde enero 2026. Pasá por secretaría.',
      member: { fee: 'VENCIDA' },
    });
  });

  it('inactive: gray, says the file is inactive', () => {
    const view = buildResultView(event({ tone: 'refused', kind: 'inactive' }));
    expect(view).toMatchObject({
      tone: 'gray',
      label: 'SOCIO INACTIVO',
      icon: '–',
      title: 'Valentina, hablá con secretaría',
      message: 'Hola, Valentina Ríos. Tu ficha figura inactiva. Pasá por secretaría.',
      member: { fee: 'INACTIVA' },
    });
  });

  it('not recognized and not found: dark, no card, no member data, a way out', () => {
    for (const kind of ['not_recognized', 'not_found'] as const) {
      const view = buildResultView({ at: 'x', tone: 'refused', kind, method: 'face' });
      expect(view, kind).toMatchObject({
        tone: 'dark',
        frameLabel: 'SIN COINCIDENCIA',
        icon: '?',
        label: 'NO PUDIMOS RECONOCERTE',
        title: 'Probá otra vez',
        message: 'Mirá de frente a la cámara, sin gorra ni anteojos. Si sigue sin funcionar, pedí ayuda en secretaría.',
        footer: 'SIEMPRE PODÉS PEDIR AYUDA EN SECRETARÍA',
      });
      expect(view.member).toBeUndefined();
      expect(view.detail).toBeUndefined();
    }
  });

  it('shows nothing about a member when the event names none, even for a member kind', () => {
    const view = buildResultView(event({ kind: 'up_to_date', member: undefined, paidThrough: '2026-08' }));
    expect(view.tone).toBe('dark');
    expect(view.member).toBeUndefined();
  });

  it('never renders a DNI, an amount or a refusal reason', () => {
    const hostile = { ...event({ kind: 'debtor', tone: 'see_desk', debtSince: '2026-06', unpaidPeriodCount: 7 }), dni: '30111222', amount: 90000, reason: 'deregistered' } as GreetingEvent;
    const text = JSON.stringify(buildResultView(hostile));
    expect(text).not.toMatch(/30111222|90000|deregistered/);
  });
});

describe('initialsOf', () => {
  it('takes the first letter of the first and the last word, uppercase', () => {
    expect(initialsOf('Valentina Ríos')).toBe('VR');
    expect(initialsOf('ana maría de los Ángeles pérez')).toBe('AP');
    expect(initialsOf('Cher')).toBe('C');
    expect(initialsOf('  ')).toBe('');
  });
});

describe('KIOSK_TEXT', () => {
  it('keeps the idle, identifying and error wording in one place', () => {
    expect(KIOSK_TEXT.idle.title).toBe('Bienvenido al club');
    expect(KIOSK_TEXT.idle.help).toBe('Mirá a la cámara para ingresar. No hace falta el carnet ni el DNI.');
    expect(KIOSK_TEXT.identifying.title).toBe('Quedate quieto un segundo…');
    expect(KIOSK_TEXT.unavailable).toBe('Reconocimiento no disponible: pedí ayuda en secretaría');
    expect(KIOSK_TEXT.sessionExpired).toBe('Sesión vencida: iniciá sesión en esta PC');
  });
});
