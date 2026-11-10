import type { ChargeLine, ClubDate } from '../payments/charge.types.js';
import type { Period } from '../payments/pricing.types.js';
import { formatReceiptNumber } from '../payments/receipt.format.js';

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

/** A receipt line worded for a message, e.g. "Cuota de Básquet octubre de 2026". */
export function describeReceiptLine(line: ChargeLine, disciplineName: (id: string) => string): string {
  const activity = disciplineName(line.disciplineId ?? '');
  switch (line.kind) {
    case 'enrollment':
      return 'Inscripción';
    case 'socialFee':
      return `Cuota social ${monthLabel(line.period)}`;
    case 'activityFee':
      return `Cuota de ${activity} ${monthLabel(line.period)}${line.prorated ? ' (prorrateada)' : ''}`;
    case 'activitySurcharge':
      return `Recargo por pago tardío de ${activity} ${monthLabel(line.period)}`;
    case 'carnetReplacement':
      return 'Reposición de carnet';
  }
}

export interface WelcomeMessageInput {
  clubName: string;
  memberName: string;
  /** Who reads the message: the member, or the guardian of a minor. */
  addressee: { kind: 'member' | 'guardian'; name: string };
  receiptNumber: number;
  paymentDate: ClubDate;
  /** What the receipt charged, already worded in Spanish. */
  concepts: readonly string[];
  total: number;
}

/**
 * The welcome as a formal WhatsApp text (usted, no emoji): `*bold*`, `_italic_` and line breaks. The salutation is
 * the gender-neutral "Estimada/o". The PDF travels in a separate message, so the text says so. Pure.
 */
export function buildWelcomeMessage({ clubName, memberName, addressee, receiptNumber, paymentDate, concepts, total }: WelcomeMessageInput): string {
  const enrollment = addressee.kind === 'guardian' ? `la inscripción de ${memberName}` : 'su inscripción';
  return [
    `*${clubName}*`,
    '',
    `Estimada/o ${addressee.name}:`,
    `Le damos la bienvenida al club. Registramos ${enrollment}.`,
    '',
    `*Comprobante N.º ${formatReceiptNumber(receiptNumber)}* · ${dayLabel(paymentDate)}`,
    ...concepts.map((concept) => `• ${concept}`),
    `*Total: $ ${pesos.format(total)}*`,
    '',
    'Le enviamos el comprobante en PDF en un mensaje aparte.',
    'Ante cualquier consulta, puede responder este mensaje.',
    '',
    `_Secretaría · ${clubName}_`,
  ].join('\n');
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
