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

export const ENROLLMENT_CAPTURES = 3;
const MAX_TEXT = 120;

/** Staff open a session for one member and confirm the member's consent, exactly as the in-window enrollment does. */
export function parseOpenEnrollmentBody(raw: unknown): { memberId: string } {
  const { memberId, consent } = asObject(raw);
  const fieldErrors: Record<string, string> = {};
  if (typeof memberId !== 'string' || memberId.trim() === '') fieldErrors.memberId = 'Member is required';
  if (consent !== true) fieldErrors.consent = 'Consent must be confirmed';
  if (Object.keys(fieldErrors).length > 0) throw new ValidationError(fieldErrors);
  return { memberId: (memberId as string).trim() };
}

export interface EnrollmentProgressInput {
  status: 'capturing' | 'failed';
  hint?: string;
  captures?: number;
  message?: string;
}

/** What the public screen reports while it guides the capture: a short hint and how many captures are done. */
export function parseEnrollmentProgressBody(raw: unknown): EnrollmentProgressInput {
  const { status, hint, captures, message } = asObject(raw);
  const fieldErrors: Record<string, string> = {};
  if (status !== 'capturing' && status !== 'failed') fieldErrors.status = 'Status must be capturing or failed';
  if (hint !== undefined && (typeof hint !== 'string' || hint.length > MAX_TEXT)) fieldErrors.hint = `Hint must be text of at most ${MAX_TEXT} characters`;
  if (message !== undefined && (typeof message !== 'string' || message.length > MAX_TEXT)) fieldErrors.message = `Message must be text of at most ${MAX_TEXT} characters`;
  if (captures !== undefined && (typeof captures !== 'number' || !Number.isInteger(captures) || captures < 0 || captures > ENROLLMENT_CAPTURES)) {
    fieldErrors.captures = `Captures must be a whole number from 0 to ${ENROLLMENT_CAPTURES}`;
  }
  if (Object.keys(fieldErrors).length > 0) throw new ValidationError(fieldErrors);
  return { status: status as 'capturing' | 'failed', hint: hint as string | undefined, captures: captures as number | undefined, message: message as string | undefined };
}

/** The public screen sends the mean descriptor and nothing else; consent was confirmed when the session opened. */
export const parseCompleteEnrollmentBody = parseRecognizeBody;

/** Enrolling needs the descriptor and an explicit `consent: true`; anything else is refused. */
export function parseEnrollBody(raw: unknown): { descriptor: number[] } {
  const { descriptor, consent } = asObject(raw);
  const fieldErrors: Record<string, string> = {};
  if (!isDescriptor(descriptor)) fieldErrors.descriptor = DESCRIPTOR_ERROR;
  if (consent !== true) fieldErrors.consent = 'Consent must be confirmed';
  if (Object.keys(fieldErrors).length > 0) throw new ValidationError(fieldErrors);
  return { descriptor: descriptor as number[] };
}
