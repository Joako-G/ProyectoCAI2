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

const RESULT_CHIP: Record<AccessResult, string> = {
  green: 'AUTORIZADO',
  yellow: 'CON AVISO',
  red: 'NO HABILITADO',
};

/** The text of the colored chip of a result; the color only reinforces it. */
export function resultChip(result: AccessResult): string {
  return RESULT_CHIP[result];
}

/** "1 registro" or "182 registros": the checks listed for the day. */
export function recordsLabel(count: number): string {
  return count === 1 ? '1 registro' : `${count} registros`;
}

export const UNAVAILABLE_MESSAGE = 'El registro de ingresos no está disponible en este servidor.';

/** Spanish copy for a failed read of the day's entries. Backend messages are English and are never shown. */
export function describeEntriesError(error: unknown): string {
  if (!(error instanceof ApiError)) return NETWORK_ERROR_MESSAGE;
  if (error.status === 403) return 'No tiene permiso para ver los ingresos.';
  return 'No se pudieron cargar los ingresos de hoy.';
}
