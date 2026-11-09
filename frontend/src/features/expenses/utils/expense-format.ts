import { NETWORK_ERROR_MESSAGE } from '../../disciplines/hooks/useDisciplinesList';
import { ApiError } from '../../members/services/members-api';
import { MAX_MONEY_DIGITS } from '../../../utils/input-limits';
import type { ExpenseCategory } from '../types/expense';

export const MAX_DESCRIPTION_LENGTH = 200;

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  services: 'Servicios',
  maintenance: 'Mantenimiento',
  supplies: 'Insumos',
  salaries: 'Sueldos',
  other: 'Otros',
};

/** The amount as a positive whole number of pesos, or null while the text is not one. */
export function parseAmount(text: string): number | null {
  const value = text.trim();
  if (!new RegExp(`^\\d{1,${MAX_MONEY_DIGITS}}$`).test(value)) return null;
  const amount = Number(value);
  return amount > 0 ? amount : null;
}

/** Spanish copy for a failed read of the expenses. Backend messages are English and are never shown. */
export function describeLoadError(error: unknown): string {
  if (!(error instanceof ApiError)) return NETWORK_ERROR_MESSAGE;
  if (error.status === 403) return 'No tiene permiso para ver los gastos.';
  return 'No se pudieron cargar los gastos. Intente de nuevo.';
}

/** Spanish copy for a failed save. */
export function describeSaveError(error: unknown): string {
  if (!(error instanceof ApiError)) return 'No se pudo confirmar el guardado. Revise la lista antes de volver a intentar.';
  if (error.status === 403) return 'No tiene permiso para registrar gastos.';
  if (error.status === 400) return 'Revise los datos: la fecha no puede ser futura y el monto debe ser un entero mayor a cero.';
  return 'No se pudo registrar el gasto. Intente de nuevo.';
}
