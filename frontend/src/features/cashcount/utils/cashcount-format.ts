import { NETWORK_ERROR_MESSAGE } from '../../disciplines/hooks/useDisciplinesList';
import { ApiError } from '../../members/services/members-api';
import { MAX_MONEY_DIGITS } from '../../../utils/input-limits';
import { formatPesos } from '../../pricing/utils/pricing-format';

/** The counted cash as a whole number of pesos, or null while the text is not one. */
export function parseCountedCash(text: string): number | null {
  const value = text.trim();
  if (!new RegExp(`^\\d{1,${MAX_MONEY_DIGITS}}$`).test(value)) return null;
  return Number(value);
}

/** Counted minus expected cash, in words: a shortage when negative, a surplus when positive. */
export function describeVariance(variance: number): string {
  if (variance === 0) return 'Sin diferencia';
  return variance < 0 ? `Faltante de ${formatPesos(-variance)}` : `Sobrante de ${formatPesos(variance)}`;
}

/** Which verdict style a variance gets: none, a shortage or a surplus. */
export function varianceTone(variance: number): 'ok' | 'short' | 'over' {
  if (variance === 0) return 'ok';
  return variance < 0 ? 'short' : 'over';
}

/** Spanish copy for a failed read of the cash count. Backend messages are English and are never shown. */
export function describeLoadError(error: unknown): string {
  if (!(error instanceof ApiError)) return NETWORK_ERROR_MESSAGE;
  if (error.status === 403) return 'No tiene permiso para ver el arqueo.';
  return 'No se pudo cargar el arqueo. Intente de nuevo.';
}

/** Spanish copy for a failed close. */
export function describeCloseError(error: unknown): string {
  if (!(error instanceof ApiError)) return 'No se pudo confirmar el cierre. Revise si el día quedó cerrado.';
  if (error.status === 403) return 'No tiene permiso para cerrar el día.';
  if (error.status === 400) return 'Revise el efectivo contado: debe ser un número entero de pesos.';
  return 'No se pudo cerrar el día. Intente de nuevo.';
}
