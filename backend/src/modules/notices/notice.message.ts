import type { ClubDate } from '../payments/charge.types.js';
import type { Period } from '../payments/pricing.types.js';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const pesos = new Intl.NumberFormat('es-AR');

export interface DebtMessageInput {
  clubName: string;
  memberName: string;
  /** Who reads the message: the member, or the guardian of a minor. */
  addressee: { kind: 'member' | 'guardian'; name: string };
  unpaidPeriods: readonly Period[];
  total: number;
  asOf: ClubDate;
}

function monthLabel(period: Period): string {
  const [year, month] = period.split('-');
  return `${MONTHS[Number(month) - 1]} de ${year}`;
}

function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

function dayLabel(date: ClubDate): string {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

/** Plain Spanish text of a debt notice. Pure; it says nothing about the consequences of the debt. */
export function buildDebtMessage({ clubName, memberName, addressee, unpaidPeriods, total, asOf }: DebtMessageInput): string {
  const months = joinList(unpaidPeriods.map(monthLabel));
  const subject = addressee.kind === 'guardian' ? `de ${memberName}` : 'a su nombre';
  return [
    `Hola ${addressee.name}, le escribimos desde ${clubName}.`,
    `Registramos cuotas pendientes ${subject}: ${months}.`,
    `El total al ${dayLabel(asOf)} es $ ${pesos.format(total)}. Este importe puede cambiar según la fecha en que se realice el pago.`,
    'Quedamos a disposición. Muchas gracias.',
  ].join(' ');
}
