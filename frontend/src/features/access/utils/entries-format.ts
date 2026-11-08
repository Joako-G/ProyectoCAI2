import { NETWORK_ERROR_MESSAGE } from '../../disciplines/hooks/useDisciplinesList';
import { ApiError } from '../../members/services/members-api';
import type { AccessResult } from '../types/access';
import type { EntryView } from '../types/entries';

const clock = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'America/Argentina/Tucuman' });

/** `2026-11-07T15:30:00.000Z` as "12:30", in the club's time zone. */
export function entryTime(iso: string): string {
  return clock.format(new Date(iso));
}

export function methodLabel(method: EntryView['method']): string {
  return method === 'face' ? 'Cámara' : 'DNI';
}

const RESULT_LABEL: Record<AccessResult, string> = {
  green: 'Ingresó',
  yellow: 'Ingresó, con deuda',
  red: 'No ingresó',
};

export function resultLabel(result: AccessResult): string {
  return RESULT_LABEL[result];
}

export function enteredLabel(count: number): string {
  return count === 1 ? '1 socio ingresó' : `${count} socios ingresaron`;
}

export const UNAVAILABLE_MESSAGE = 'El registro de ingresos no está disponible en este servidor.';

/** Spanish copy for a failed read of the day's entries. Backend messages are English and are never shown. */
export function describeEntriesError(error: unknown): string {
  if (!(error instanceof ApiError)) return NETWORK_ERROR_MESSAGE;
  if (error.status === 403) return 'No tiene permiso para ver los ingresos.';
  return 'No se pudieron cargar los ingresos de hoy.';
}
