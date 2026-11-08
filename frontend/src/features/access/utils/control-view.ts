import type { EntranceKind, EntranceMethod, GreetingEvent } from '../types/greeting';
import { monthLabel } from './access-format';
import { entryTime } from './entries-format';
import { initialsOf } from './kiosk-texts';

/** Every word of the secretary's "last control" panel. The colors live in the stylesheet, keyed by `tone`. */
export type BannerTone = 'green' | 'amber' | 'red' | 'gray' | 'neutral';

export interface ControlBanner {
  tone: BannerTone;
  title: string;
  detail: string;
  /** "Cámara" or "DNI"; absent before the first control. */
  method?: string;
  /** `HH:MM` in the club time zone; absent before the first control. */
  time?: string;
}

export const WAITING_BANNER: ControlBanner = {
  tone: 'neutral',
  title: 'Esperando el primer control',
  detail: 'El resultado de cada control aparece acá.',
};

const METHOD_LABEL: Record<EntranceMethod, string> = { face: 'Cámara', dni: 'DNI' };

/** `2027-01-10` as "10/01/2027". */
function dayLabel(day: string): string {
  const [year, month, date] = day.split('-');
  return `${date}/${month}/${year}`;
}

function debtLine(event: GreetingEvent): string {
  return `Tiene cuotas pendientes${event.debtSince ? ` desde ${monthLabel(event.debtSince)}` : ''}.`;
}

function upToDateLine(event: GreetingEvent): string {
  if (event.dueDate) return `La cuota vence el ${dayLabel(event.dueDate)}.`;
  if (event.paidThrough) return `Cuota paga hasta ${monthLabel(event.paidThrough)}.`;
  return 'Cuota al día.';
}

function describe(event: GreetingEvent): Pick<ControlBanner, 'tone' | 'title' | 'detail'> {
  switch (event.kind) {
    case 'up_to_date': return { tone: 'green', title: 'Acceso autorizado', detail: upToDateLine(event) };
    case 'debtor': return { tone: 'amber', title: 'Acceso autorizado · avisar', detail: debtLine(event) };
    case 'deregistered': return { tone: 'red', title: 'Acceso no habilitado', detail: `${debtLine(event)} Debe pasar por caja.` };
    case 'inactive': return { tone: 'gray', title: 'Socio inactivo', detail: 'La ficha figura inactiva.' };
    case 'not_found': return { tone: 'gray', title: 'No reconocido', detail: 'Ese DNI no está registrado.' };
    case 'not_recognized':
      return { tone: 'gray', title: 'No reconocido', detail: 'La cámara no encontró coincidencia. Ingresá el DNI del socio.' };
  }
}

/** The banner for the last control; the waiting banner before there is one. */
export function buildControlBanner(event: GreetingEvent | undefined): ControlBanner {
  if (!event) return WAITING_BANNER;
  return { ...describe(event), method: METHOD_LABEL[event.method], time: entryTime(event.at) };
}

/** What the member card learns after the event, through the members and payments APIs. Anything may be missing. */
export interface MemberDetails {
  /** Digits only. */
  dni?: string;
  age?: number;
  category?: string;
  /** `YYYY-MM-DD`. */
  memberSince?: string;
  /** `YYYY-MM-DD` of the last payment that was not annulled. */
  lastPayment?: string;
}

export interface MemberCard {
  name: string;
  initials: string;
  number: string;
  subtitle: string;
  facts: Array<{ label: string; value: string }>;
  /** Names only, no days and no remaining counts. */
  disciplines: string[];
}

const NONE = '—';

const STANDING: Record<Exclude<EntranceKind, 'not_recognized' | 'not_found'>, string> = {
  up_to_date: 'Al día',
  debtor: 'Pendiente',
  deregistered: 'Vencida',
  inactive: 'Inactivo',
};

/** `30123456` as "30.123.456". */
export function formatDni(dni: string): string {
  return dni === '' ? NONE : dni.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function dueValue(event: GreetingEvent): string {
  if (event.kind === 'up_to_date') return event.dueDate ? dayLabel(event.dueDate) : NONE;
  if ((event.kind === 'debtor' || event.kind === 'deregistered') && event.debtSince) return `Debe desde ${monthLabel(event.debtSince)}`;
  return NONE;
}

function subtitleOf({ age, category, memberSince }: MemberDetails): string {
  const parts = [
    age === undefined ? undefined : `${age} ${age === 1 ? 'año' : 'años'}`,
    category,
    memberSince ? `Socio desde ${memberSince.slice(5, 7)}/${memberSince.slice(0, 4)}` : undefined,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(' · ') : NONE;
}

/** The member card of an identified member, or nothing when the check identified nobody. */
export function buildMemberCard(event: GreetingEvent, details: MemberDetails): MemberCard | undefined {
  const { member } = event;
  if (!member || event.kind === 'not_recognized' || event.kind === 'not_found') return undefined;
  return {
    name: member.fullName,
    initials: initialsOf(member.fullName),
    number: member.memberNumber,
    subtitle: subtitleOf(details),
    facts: [
      { label: 'DNI', value: details.dni ? formatDni(details.dni) : NONE },
      { label: 'CUOTA VENCE', value: dueValue(event) },
      { label: 'ESTADO DE CUENTA', value: STANDING[event.kind] },
      { label: 'ÚLTIMO PAGO', value: details.lastPayment ? dayLabel(details.lastPayment) : NONE },
    ],
    disciplines: member.disciplines,
  };
}
