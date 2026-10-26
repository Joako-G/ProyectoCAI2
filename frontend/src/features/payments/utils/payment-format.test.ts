import { describe, expect, it } from 'vitest';
import { ApiError } from '../../members/services/members-api';
import { buildDiscipline } from '../../disciplines/test/fixtures';
import { isAmbiguousWriteFailure, newRequestId, conceptKey, conceptLabel, describePaymentError, describeReadError, lineLabel, methodLabel } from './payment-format';

const disciplines = [buildDiscipline()];

describe('conceptKey', () => {
  it('identifies a concept the same way the server does', () => {
    expect(conceptKey({ kind: 'socialFee', period: '2026-09' })).toBe('socialFee:2026-09');
    expect(conceptKey({ kind: 'activityFee', period: '2026-09', disciplineId: 'disc-1' })).toBe('activityFee:2026-09:disc-1');
    expect(conceptKey({ kind: 'carnetReplacement' })).toBe('carnetReplacement');
  });
});

describe('labels', () => {
  it('labels owed concepts with the discipline name and an MM/YYYY period', () => {
    expect(conceptLabel({ kind: 'socialFee', period: '2026-09' }, disciplines)).toBe('Cuota social 09/2026');
    expect(conceptLabel({ kind: 'activityFee', period: '2026-09', disciplineId: 'disc-1' }, disciplines)).toBe('Cuota de Básquet 09/2026');
  });

  it('labels charge lines, flagging surcharges and prorated fees', () => {
    expect(lineLabel({ kind: 'activitySurcharge', period: '2026-09', disciplineId: 'disc-1', amount: 1 }, disciplines)).toBe('Recargo por pago tardío de Básquet 09/2026');
    expect(lineLabel({ kind: 'activityFee', period: '2026-10', disciplineId: 'disc-1', amount: 1, prorated: true }, disciplines)).toBe('Cuota de Básquet 10/2026 (prorrateada)');
    expect(lineLabel({ kind: 'enrollment', period: '2026-10', amount: 1 }, disciplines)).toBe('Inscripción');
    expect(lineLabel({ kind: 'carnetReplacement', period: '2026-10', amount: 1 }, disciplines)).toBe('Reposición de carnet');
  });

  it('falls back to the id for a discipline missing from the catalog', () => {
    expect(conceptLabel({ kind: 'activityFee', period: '2026-09', disciplineId: 'gone' }, disciplines)).toBe('Cuota de gone 09/2026');
  });

  it('names the payment methods in Spanish', () => {
    expect(['cash', 'debit', 'qr', 'transfer'].map((method) => methodLabel(method as 'cash'))).toEqual(['Efectivo', 'Débito', 'QR', 'Transferencia']);
  });
});

describe('isAmbiguousWriteFailure', () => {
  it('re-reads after network, 404, 409 and any 5xx, but not after 400 or 403', () => {
    const api = (status: number) => new ApiError(status, 'x', 'm');
    expect([new TypeError('x'), api(404), api(409), api(500), api(502)].map(isAmbiguousWriteFailure)).toEqual([true, true, true, true, true]);
    expect([api(400), api(403)].map(isAmbiguousWriteFailure)).toEqual([false, false]);
  });
});

describe('newRequestId', () => {
  it('is 8 to 100 characters, unique, and works without crypto.randomUUID (insecure contexts)', () => {
    expect(newRequestId()).not.toBe(newRequestId());
    const original = crypto.randomUUID;
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
    try {
      const id = newRequestId();
      expect(id.length).toBeGreaterThanOrEqual(8);
      expect(id.length).toBeLessThanOrEqual(100);
    } finally {
      Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true });
    }
  });
});

describe('error copy', () => {
  const api = (status: number, message: string) => new ApiError(status, 'x', message);

  it('explains an already paid concept without the backend English text', () => {
    expect(describePaymentError(api(409, 'Already paid: socialFee:2026-09'))).toBe('Alguno de los conceptos ya está pagado. La cuenta se actualizó con los datos del servidor.');
  });

  it('explains an inactive member, an annulled payment, permissions, a missing record and a network failure', () => {
    expect(describePaymentError(api(409, 'Inactive members cannot make payments'))).toBe('El socio está dado de baja y no puede registrar pagos.');
    expect(describePaymentError(api(409, 'Payment is already annulled'))).toBe('El pago ya estaba anulado.');
    expect(describePaymentError(api(403, 'Forbidden'))).toBe('No tiene permiso para realizar esta operación.');
    expect(describePaymentError(api(404, 'Payment not found'))).toBe('No se encontró el socio o el pago. Actualice la pantalla.');
    expect(describePaymentError(new TypeError('Failed to fetch'))).toBe('No se pudo conectar con el servidor.');
  });

  it('never leaks English backend text for other failures', () => {
    expect(describePaymentError(api(400, 'Unknown concept'))).toBe('El servidor rechazó los datos. Revíselos e intente de nuevo.');
    expect(describePaymentError(api(500, 'Boom'))).toBe('No se pudo completar la operación. Intente de nuevo.');
    expect(describeReadError(api(500, 'Boom'))).toBe('El servidor no pudo completar la consulta.');
    expect(describeReadError(api(404, 'Member not found'))).toBe('No se encontró el socio.');
    expect(describeReadError(api(403, 'Forbidden'))).toBe('No tiene permiso para ver los pagos.');
  });
});
