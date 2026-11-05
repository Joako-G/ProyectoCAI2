import { NETWORK_ERROR_MESSAGE } from '../../disciplines/hooks/useDisciplinesList';
import { ApiError } from '../../members/services/members-api';
import type { AccessCheck } from '../types/access';

/** Spanish copy for a failed check. Backend messages are English and are never shown. */
export function describeCheckError(error: unknown): string {
  if (!(error instanceof ApiError)) return NETWORK_ERROR_MESSAGE;
  if (error.status === 400) return 'Ingrese un DNI de 7 u 8 dígitos.';
  if (error.status === 403) return 'No tiene permiso para controlar el ingreso.';
  return 'No se pudo verificar el DNI. Intente de nuevo.';
}

const REFUSAL_REASON: Record<Exclude<AccessCheck['reason'], 'up_to_date' | 'debtor'>, string> = {
  deregistered: 'dado de baja',
  inactive: 'inactivo',
  not_found: 'DNI no registrado',
};

/** The headline the door staff read: the verdict in words, so the color is never the only signal. */
export function accessHeadline({ reason, member }: AccessCheck): string {
  if (reason === 'up_to_date') return 'Puede ingresar';
  if (reason === 'debtor') {
    const months = member?.unpaidPeriodCount ?? 0;
    return `Puede ingresar — tiene ${months} ${months === 1 ? 'mes adeudado' : 'meses adeudados'}`;
  }
  return `No puede ingresar — ${REFUSAL_REASON[reason]}`;
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** `2026-10` as "octubre 2026". */
function monthLabel(period: string): string {
  const [year, month] = period.split('-');
  return `${MONTHS[Number(month) - 1]} ${year}`;
}

/** The month line under the member: paid-through or debt-since. Empty when the answer has no date. */
export function accessMonthLine({ member }: AccessCheck): string | null {
  if (member?.paidThrough) return `Pagado hasta ${monthLabel(member.paidThrough)}`;
  if (member?.debtSince) return `Debe desde ${monthLabel(member.debtSince)}`;
  return null;
}

/** The due line under the paid-through month: `2027-01-10` as "Vence el 10/01/2027". Empty when there is no due date. */
export function accessDueLine({ member }: AccessCheck): string | null {
  if (!member?.dueDate) return null;
  const [year, month, day] = member.dueDate.split('-');
  return `Vence el ${day}/${month}/${year}`;
}
