import { describe, expect, it } from 'vitest';
import { ApiError } from '../../members/services/members-api';
import { describePricingError, isAmbiguousWriteFailure } from './pricing-format';

const apiError = (status: number, message = 'x') => new ApiError(status, 'code', message);

describe('describePricingError', () => {
  it.each([
    [apiError(403), 'No tiene permiso para modificar los precios.'],
    [apiError(404, 'No tariff starts on 2026-12'), 'La tarifa ya no existe. Actualice la pantalla.'],
    [apiError(400), 'El servidor rechazó los valores ingresados. Revíselos e intente de nuevo.'],
    [apiError(409, 'something unexpected'), 'No se pudo guardar el cambio. Intente de nuevo.'],
    [apiError(500), 'No se pudo guardar el cambio. Intente de nuevo.'],
    [new TypeError('offline'), 'No se pudo conectar con el servidor.'],
  ])('maps %s', (error, copy) => {
    expect(describePricingError(error)).toBe(copy);
  });
});

describe('isAmbiguousWriteFailure', () => {
  it('is true when the outcome is unknown or the view may be stale', () => {
    expect(isAmbiguousWriteFailure(new TypeError('offline'))).toBe(true);
    expect(isAmbiguousWriteFailure(apiError(404))).toBe(true);
    expect(isAmbiguousWriteFailure(apiError(409))).toBe(true);
  });

  it('is false for validation and permission errors', () => {
    expect(isAmbiguousWriteFailure(apiError(400))).toBe(false);
    expect(isAmbiguousWriteFailure(apiError(403))).toBe(false);
  });
});
