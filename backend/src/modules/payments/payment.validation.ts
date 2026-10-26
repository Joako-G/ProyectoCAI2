import { ValidationError } from '../../shared/errors.js';
import type { ChargeConcept } from './charge.types.js';
import type { PaymentMethod, RegistrationRequest } from './payment.types.js';

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationError({ body: 'Must be a JSON object' });
  }
  return value as Record<string, unknown>;
}

function parseMemberId(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') throw new ValidationError({ memberId: 'Required' });
  return value.trim();
}

function parseRegistration(value: unknown): RegistrationRequest | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError({ registration: 'Must be a JSON object' });
  }
  // Any enrollmentDate sent is dropped: the service uses the club-local day the payment is taken.
  return {};
}

export interface PreviewBody {
  memberId: string;
  concepts: ChargeConcept[];
  registration?: RegistrationRequest;
}

export interface RegisterBody extends PreviewBody {
  method: PaymentMethod;
}

// Only the fields the service reads are picked, so amounts, totals or actors in the body are never seen.
// Concept values are passed through as-is: the charge calculation rejects anything that is not valid.
export function parsePreviewBody(body: unknown): PreviewBody {
  const record = asRecord(body);
  const registration = parseRegistration(record.registration);
  return {
    memberId: parseMemberId(record.memberId),
    concepts: record.concepts as ChargeConcept[],
    ...(registration ? { registration } : {}),
  };
}

// `method` is passed through; the service rejects anything that is not a known payment method.
export function parseRegisterBody(body: unknown): RegisterBody {
  return { ...parsePreviewBody(body), method: asRecord(body).method as PaymentMethod };
}

// `reason` is passed through; the service requires non-blank text of a bounded length.
export function parseAnnulBody(body: unknown): { reason: string } {
  return { reason: asRecord(body).reason as string };
}

/**
 * A receipt number in the path: digits only, so `abc` or `1.5` is a 400 rather than a lookup. At most 15
 * digits keeps the value below Number.MAX_SAFE_INTEGER (16 digits), so the conversion is exact.
 */
export function parseReceiptNumber(value: string): number {
  if (!/^\d{1,15}$/.test(value)) throw new ValidationError({ receiptNumber: 'Must be a whole number' });
  return Number(value);
}
