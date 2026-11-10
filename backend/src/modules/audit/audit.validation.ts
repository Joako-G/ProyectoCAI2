import { ValidationError } from '../../shared/errors.js';
import { isRealDate } from '../expenses/expense.validation.js';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, type AuditAction, type AuditEntityType, type AuditQuery } from './audit.types.js';

const MAX_ACTOR_ID_LENGTH = 100;
const MEMBER_NUMBER = /^\d{1,10}$/;

/**
 * Validates the optional filters of `GET /api/audit`. A bad value is a 400 with a field error, never ignored,
 * so a mistyped filter cannot silently show the whole log. A repeated parameter arrives as an array and fails too.
 */
export function parseAuditQuery(query: Record<string, unknown>): AuditQuery {
  const result: AuditQuery = {};
  const errors: Record<string, string> = {};

  if (query.actorId !== undefined) {
    if (typeof query.actorId === 'string' && query.actorId.length > 0 && query.actorId.length <= MAX_ACTOR_ID_LENGTH) {
      result.actorId = query.actorId;
    } else errors.actorId = `Must be a user id of at most ${MAX_ACTOR_ID_LENGTH} characters`;
  }
  if (query.member !== undefined) {
    if (typeof query.member === 'string' && MEMBER_NUMBER.test(query.member)) result.member = query.member;
    else errors.member = 'Must be a member number, digits only';
  }
  if (query.entityType !== undefined) {
    if (typeof query.entityType === 'string' && (AUDIT_ENTITY_TYPES as readonly string[]).includes(query.entityType)) {
      result.entityType = query.entityType as AuditEntityType;
    } else errors.entityType = `Must be one of: ${AUDIT_ENTITY_TYPES.join(', ')}`;
  }
  if (query.action !== undefined) {
    if (typeof query.action === 'string' && (AUDIT_ACTIONS as readonly string[]).includes(query.action)) {
      result.action = query.action as AuditAction;
    } else errors.action = `Must be one of: ${AUDIT_ACTIONS.join(', ')}`;
  }
  for (const field of ['from', 'to'] as const) {
    const value = query[field];
    if (value === undefined) continue;
    if (typeof value === 'string' && isRealDate(value)) result[field] = value;
    else errors[field] = 'Must be a date as YYYY-MM-DD';
  }
  if (!errors.from && !errors.to && result.from && result.to && result.from > result.to) errors.to = 'Must not be before from';

  if (Object.keys(errors).length > 0) throw new ValidationError(errors);
  return result;
}
