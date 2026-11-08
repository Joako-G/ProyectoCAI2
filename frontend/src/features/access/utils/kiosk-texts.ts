import type { EntranceKind, GreetingEvent } from '../types/greeting';
import { monthLabel } from './access-format';

/**
 * Every word the client screen says, in one module so the club can change the wording in one place. The screen
 * never shows a DNI, an amount, a number of months or the reason of a refusal; this module has no way to.
 */
export const KIOSK_TEXT = {
  idle: {
    title: 'Bienvenido al club',
    help: 'Mirá a la cámara para ingresar. No hace falta el carnet ni el DNI.',
    fallbackLead: '¿No funciona? ',
    fallbackStrong: 'Pedí ayuda en secretaría',
    fallbackRest: ': te buscan por DNI.',
    waiting: 'EN ESPERA · ACERCATE Y MIRÁ A LA CÁMARA',
    frameLabel: 'BUSCANDO ROSTRO',
  },
  identifying: {
    label: 'IDENTIFICANDO',
    title: 'Quedate quieto un segundo…',
    body: 'Estamos verificando tu rostro y el estado de tu cuota.',
    frameLabel: 'ANALIZANDO ROSTRO',
    comparing: 'COMPARANDO CON EL PADRÓN',
    notStored: 'NO SE GUARDA LA IMAGEN',
  },
  camera: {
    live: 'CÁMARA DE ACCESO · EN VIVO',
    placeholder: 'VISTA DE LA CÁMARA',
    starting: 'Preparando la cámara…',
    offline: 'Reconectando…',
  },
  registered: 'REGISTRADO EN EL SISTEMA',
  unavailable: 'Reconocimiento no disponible: pedí ayuda en secretaría',
  sessionExpired: 'Sesión vencida: iniciá sesión en esta PC',
  signIn: 'Iniciar sesión',
  outOfService: { label: 'SIN SERVICIO', frameLabel: 'SIN SERVICIO', icon: '–' },
} as const;

/** What the result view needs, with no colors: the screen maps `tone` to its palette. */
export type ResultTone = 'green' | 'amber' | 'red' | 'gray' | 'dark';

export interface KioskResultView {
  tone: ResultTone;
  frameLabel: string;
  icon: string;
  label: string;
  title: string;
  /** Present only for an identified member. */
  member?: { name: string; initials: string; number: string; fee: string };
  message: string;
  detail?: { label: string; value: string };
  footer: string;
}

const MEMBER_FOOTER = 'ACCESO REGISTRADO · PUERTA PRINCIPAL';
const FOUND_FRAME = 'ROSTRO IDENTIFICADO';

/** First letter of the first and of the last word of a name, uppercase; one letter for a single word. */
export function initialsOf(fullName: string): string {
  const words = fullName.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const first = words[0]!;
  const last = words.length > 1 ? words[words.length - 1]! : '';
  return `${first[0]}${last[0] ?? ''}`.toUpperCase();
}

/** `2026-09-10` as "10/09/2026". */
function dayLabel(day: string): string {
  const [year, month, date] = day.split('-');
  return `${date}/${month}/${year}`;
}

const NOT_RECOGNIZED_VIEW: KioskResultView = {
  tone: 'dark',
  frameLabel: 'SIN COINCIDENCIA',
  icon: '?',
  label: 'NO PUDIMOS RECONOCERTE',
  title: 'Probá otra vez',
  message: 'Mirá de frente a la cámara, sin gorra ni anteojos. Si sigue sin funcionar, pedí ayuda en secretaría.',
  footer: 'SIEMPRE PODÉS PEDIR AYUDA EN SECRETARÍA',
};

type MemberKind = Exclude<EntranceKind, 'not_recognized' | 'not_found'>;

const MEMBER_VIEWS: Record<MemberKind, { tone: ResultTone; icon: string; label: string; fee: string; title: (firstName: string) => string }> = {
  up_to_date: { tone: 'green', icon: '✓', label: 'ACCESO AUTORIZADO', fee: 'AL DÍA', title: (name) => `Pasá, ${name}` },
  debtor: { tone: 'amber', icon: '!', label: 'ACCESO AUTORIZADO · AVISO', fee: 'PENDIENTE', title: (name) => `Pasá, ${name}` },
  deregistered: { tone: 'red', icon: '×', label: 'ACCESO NO HABILITADO', fee: 'VENCIDA', title: (name) => `${name}, pasá por secretaría` },
  inactive: { tone: 'gray', icon: '–', label: 'SOCIO INACTIVO', fee: 'INACTIVA', title: (name) => `${name}, hablá con secretaría` },
};

function messageFor(kind: MemberKind, fullName: string, event: GreetingEvent): string {
  if (kind === 'up_to_date') {
    const paid = event.paidThrough ? `Tu cuota está paga hasta ${monthLabel(event.paidThrough)}.` : 'Tu cuota está al día.';
    const disciplines = event.member?.disciplines ?? [];
    return disciplines.length > 0 ? `${paid} Disciplinas: ${disciplines.join(', ')}.` : paid;
  }
  if (kind === 'inactive') return `Hola, ${fullName}. Tu ficha figura inactiva. Pasá por secretaría.`;
  const since = event.debtSince ? ` desde ${monthLabel(event.debtSince)}` : '';
  return `Hola, ${fullName}. Tenés cuotas pendientes${since}. Pasá por secretaría.`;
}

/**
 * The result panel for one entrance event. A check that named nobody, or an event that carries no member, gives the
 * "try again" view with no member data: nothing about a person appears unless the face matched.
 */
export function buildResultView(event: GreetingEvent): KioskResultView {
  const { kind, member } = event;
  if (kind === 'not_recognized' || kind === 'not_found' || !member) return NOT_RECOGNIZED_VIEW;
  const style = MEMBER_VIEWS[kind];
  return {
    tone: style.tone,
    frameLabel: FOUND_FRAME,
    icon: style.icon,
    label: style.label,
    title: style.title(member.firstName),
    member: { name: member.fullName, initials: initialsOf(member.fullName), number: member.memberNumber, fee: style.fee },
    message: messageFor(kind, member.fullName, event),
    ...(kind === 'up_to_date' && event.dueDate ? { detail: { label: 'Próximo vencimiento', value: dayLabel(event.dueDate) } } : {}),
    footer: MEMBER_FOOTER,
  };
}
