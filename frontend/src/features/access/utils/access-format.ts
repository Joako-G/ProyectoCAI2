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
