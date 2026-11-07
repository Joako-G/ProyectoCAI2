import { ValidationError } from '../../shared/errors.js';

/** face-api.js describes a face with 128 numbers. */
export const DESCRIPTOR_LENGTH = 128;

const asObject = (raw: unknown): Record<string, unknown> => (typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {});

const isDescriptor = (value: unknown): value is number[] =>
  Array.isArray(value) && value.length === DESCRIPTOR_LENGTH && value.every((item) => typeof item === 'number' && Number.isFinite(item));

// The messages are fixed on purpose: a descriptor is biometric data and is never echoed back.
const DESCRIPTOR_ERROR = `Descriptor must be ${DESCRIPTOR_LENGTH} finite numbers`;

export function parseRecognizeBody(raw: unknown): { descriptor: number[] } {
  const { descriptor } = asObject(raw);
  if (!isDescriptor(descriptor)) throw new ValidationError({ descriptor: DESCRIPTOR_ERROR });
  return { descriptor };
}

/** Enrolling needs the descriptor and an explicit `consent: true`; anything else is refused. */
export function parseEnrollBody(raw: unknown): { descriptor: number[] } {
  const { descriptor, consent } = asObject(raw);
  const fieldErrors: Record<string, string> = {};
  if (!isDescriptor(descriptor)) fieldErrors.descriptor = DESCRIPTOR_ERROR;
  if (consent !== true) fieldErrors.consent = 'Consent must be confirmed';
  if (Object.keys(fieldErrors).length > 0) throw new ValidationError(fieldErrors);
  return { descriptor: descriptor as number[] };
}
