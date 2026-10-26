import { ApiError } from '../../members/services/members-api';
import { NETWORK_ERROR_MESSAGE } from '../../disciplines/hooks/useDisciplinesList';

const pesos = new Intl.NumberFormat('es-AR');

/** Whole pesos, with Argentine thousands separators: `$ 15.000`. */
export function formatPesos(amount: number): string {
  return `$ ${pesos.format(amount)}`;
}

/** `2026-10` becomes `10/2026`. */
export function formatPeriod(period: string): string {
  const [year, month] = period.split('-');
  return `${month}/${year}`;
}

/**
 * A failed write whose outcome is unknown (network error) or whose view is stale (404, 409): the screen
 * should be re-read so it matches the server. Validation (400) and permission (403) errors changed nothing.
 */
export function isAmbiguousWriteFailure(error: unknown): boolean {
  return !(error instanceof ApiError) || error.status === 404 || error.status === 409;
}

/** Spanish copy for a failed pricing write. The backend messages are English and are never shown. */
export function describePricingError(error: unknown): string {
  if (!(error instanceof ApiError)) return NETWORK_ERROR_MESSAGE;
  const { status, message } = error;
  if (status === 403) return 'No tiene permiso para modificar los precios.';
  if (status === 409) {
    // The English phrases below come from ConflictError messages in
    // backend/src/modules/payments/pricing-config.service.ts (assertNotPast, addTariff, deleteTariff).
    // If a phrase changes there, update it here; an unknown one falls back to the generic copy.
    if (/is in the past/.test(message)) return 'Las tarifas de meses pasados no se pueden modificar.';
    if (/already starts on/.test(message)) return 'Ya existe una tarifa para ese mes.';
    if (/no tariff in force/.test(message)) return 'No se puede eliminar: el mes actual quedaría sin tarifa vigente.';
  }
  if (status === 404) return 'La tarifa ya no existe. Actualice la pantalla.';
  if (status === 400) return 'El servidor rechazó los valores ingresados. Revíselos e intente de nuevo.';
  return 'No se pudo guardar el cambio. Intente de nuevo.';
}
