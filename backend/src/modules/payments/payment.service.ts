import { randomUUID } from 'node:crypto';
import { toIsoDate } from '../../shared/date.js';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors.js';
import type { Membership } from '../memberships/membership.types.js';
import { accountStanding, conceptKey, owedConcepts, settledKeys, type AccountMember } from './account.js';
import { nextPeriod, sameMonthlyFees } from './pricing.js';
import { calculateCharge } from './charge.js';
import type { Charge, ChargeConcept, FirstTimeRegistration } from './charge.types.js';
import type { PaymentRepository } from './payment.repository.js';
import { parseRequestId } from './payment.validation.js';
import {
  PAYMENT_METHODS,
  type AccountStanding,
  type MemberAccount,
  type OwedPeriod,
  type Payment,
  type PreviewOptions,
  type RegisterPaymentInput,
} from './payment.types.js';
import type { PricingConfig } from './pricing-config.types.js';

const MAX_REASON_LENGTH = 500;

/** The slice of the members service the payments module needs. */
export interface PaymentMemberLookup {
  getById(id: string): Promise<AccountMember>;
}

export interface PaymentMembershipSource {
  list(query: { memberId: string }): Promise<Membership[]>;
}

export interface PaymentPricingSource {
  get(): Promise<PricingConfig>;
}

export interface PaymentServiceDeps {
  repository: PaymentRepository;
  members: PaymentMemberLookup;
  memberships: PaymentMembershipSource;
  pricing: PaymentPricingSource;
  now?: () => Date;
}

function requireText(value: unknown, field: string, maxLength: number): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text === '') throw new ValidationError({ [field]: 'Required' });
  if (text.length > maxLength) throw new ValidationError({ [field]: `Must be at most ${maxLength} characters` });
  return text;
}

// Copies only the fields each concept kind owns, so a client-sent amount can never reach the charge.
function sanitizeConcepts(concepts: readonly ChargeConcept[]): ChargeConcept[] {
  if (!Array.isArray(concepts)) throw new ValidationError({ concepts: 'Must be a list of concepts' });
  return concepts.map((concept) => {
    switch (concept?.kind) {
      case 'socialFee':
        return { kind: 'socialFee', period: concept.period };
      case 'activityFee':
        return { kind: 'activityFee', period: concept.period, disciplineId: concept.disciplineId };
      case 'enrollment':
      case 'carnetReplacement':
        return { kind: concept.kind };
      default:
        throw new ValidationError({ concepts: 'Unknown concept' });
    }
  });
}

// The concepts a stored payment settled, compared with a new request regardless of order. Surcharge
// lines are derived from activity fees, so they are not concepts the client asked for.
function sameConcepts(payment: Payment, concepts: readonly ChargeConcept[]): boolean {
  const stored = payment.lines.filter((line) => line.kind !== 'activitySurcharge').map(lineKey).sort();
  return JSON.stringify(stored) === JSON.stringify(concepts.map(conceptKey).sort());
}

// Stored activity lines always carry a disciplineId (the repository shape check refuses a file otherwise),
// so the empty fallback only satisfies the optional type and can never cause a false match or a false 409.
function lineKey(line: Payment['lines'][number]): string {
  if (line.kind === 'socialFee') return conceptKey({ kind: 'socialFee', period: line.period });
  if (line.kind === 'activityFee') return conceptKey({ kind: 'activityFee', period: line.period, disciplineId: line.disciplineId ?? '' });
  return line.kind;
}

function earliestTariffPeriod(config: PricingConfig): string {
  if (config.tariffs.length === 0) throw new ConflictError('No tariffs are configured');
  return config.tariffs.reduce((earliest, tariff) => (tariff.effectiveFrom < earliest ? tariff.effectiveFrom : earliest), config.tariffs[0]!.effectiveFrom);
}

// The unpaid fees of the month after `asOf`, offered to an up-to-date member only while that month costs the same.
function advanceOffer(
  member: AccountMember,
  history: readonly Membership[],
  payments: readonly Payment[],
  config: PricingConfig,
  asOf: string,
): OwedPeriod | undefined {
  const period = nextPeriod(asOf.slice(0, 7));
  if (!sameMonthlyFees(config.tariffs, asOf.slice(0, 7), period)) return undefined;
  const owedThrough = owedConcepts({ member, memberships: history, payments, firstPeriod: period, asOf: `${period}-01` });
  return owedThrough.find((entry) => entry.period === period);
}

export function createPaymentService({ repository, members, memberships, pricing, now = () => new Date() }: PaymentServiceDeps) {
  const today = () => toIsoDate(now());

  function chargeFor(
    config: PricingConfig,
    concepts: ChargeConcept[],
    registration: FirstTimeRegistration | undefined,
    allowAdvance = false,
  ): Charge {
    return calculateCharge({
      tariffs: config.tariffs,
      surchargeTiers: config.surchargeTiers,
      prorationRule: config.prorationRule,
      paymentDate: today(),
      concepts,
      allowAdvance,
      ...(registration ? { registration } : {}),
    });
  }

  // The account as of today, derived from the given payments, so register can run it on the list it is about to extend.
  function standingFor(member: AccountMember, history: readonly Membership[], payments: readonly Payment[], config: PricingConfig) {
    const owed = owedConcepts({ member, memberships: history, payments, firstPeriod: earliestTariffPeriod(config), asOf: today() });
    return { owed, standing: accountStanding(owed) };
  }

  // The social and activity fees a client asks for must be ones the member owes today or is offered in advance;
  // anything else (a discipline the member is not in, a month before joining) is never charged.
  function assertOffered(
    concepts: readonly ChargeConcept[],
    member: AccountMember,
    history: readonly Membership[],
    payments: readonly Payment[],
    config: PricingConfig,
    owed: readonly OwedPeriod[],
    standing: AccountStanding,
  ): void {
    const advance = standing === 'up_to_date' && member.status === 'active' ? advanceOffer(member, history, payments, config, today()) : undefined;
    const offered = new Set([...owed, ...(advance ? [advance] : [])].flatMap((entry) => entry.concepts.map(conceptKey)));
    const notOffered = concepts
      .filter((concept) => concept.kind === 'socialFee' || concept.kind === 'activityFee')
      .map(conceptKey)
      .filter((key) => !offered.has(key));
    if (notOffered.length > 0) throw new ValidationError({ concepts: `Not owed: ${notOffered.join(', ')}` });
  }

  // Enrollment belongs to a new member (no payment yet) or to one who fell to deregistered; anyone else already paid it.
  function enrollmentOpen(payments: readonly Payment[], memberId: string, standing: AccountStanding): boolean {
    const hasPaid = payments.some((payment) => payment.memberId === memberId && !payment.annulment);
    return !hasPaid || standing === 'deregistered';
  }

  function assertEnrollmentOpen(payments: readonly Payment[], memberId: string, standing: AccountStanding): void {
    if (!enrollmentOpen(payments, memberId, standing)) throw new ConflictError('Already paid: enrollment');
  }

  // A first-time registration is charged on the day it is made; a client-sent date is never trusted.
  // The one place the enrollment date is decided, used for pricing and for the stored payment.
  function registrationFor(request: PreviewOptions['registration']): FirstTimeRegistration | undefined {
    return request ? { enrollmentDate: today() } : undefined;
  }

  async function findPayment(match: (payment: Payment) => boolean): Promise<Payment> {
    const found = (await repository.list()).find(match);
    if (!found) throw new NotFoundError('Payment not found');
    return found;
  }

  return {
    // The charge for the given concepts as of today, without writing anything.
    async preview(memberId: string, concepts: readonly ChargeConcept[], options: PreviewOptions = {}): Promise<Charge> {
      const member = await members.getById(memberId);
      const sanitized = sanitizeConcepts(concepts);
      const registration = registrationFor(options.registration);
      const [config, history, payments] = await Promise.all([pricing.get(), memberships.list({ memberId }), repository.list()]);
      const { owed, standing } = standingFor(member, history, payments, config);
      if (registration) assertEnrollmentOpen(payments, memberId, standing);
      assertOffered(sanitized, member, history, payments, config, owed, standing);
      return chargeFor(config, sanitized, registration, standing === 'up_to_date');
    },

    // Recomputes the charge server-side and writes one payment with the next receipt number, atomically.
    async register(memberId: string, input: RegisterPaymentInput, actorId: string): Promise<Payment> {
      const member = await members.getById(memberId);
      if (!PAYMENT_METHODS.includes(input.method)) {
        throw new ValidationError({ method: `Must be one of ${PAYMENT_METHODS.join(', ')}` });
      }
      const actor = requireText(actorId, 'actorId', 100);
      const concepts = sanitizeConcepts(input.concepts);
      const requestId = input.requestId === undefined ? undefined : parseRequestId(input.requestId);
      if (member.status !== 'active') throw new ConflictError('Inactive members cannot make payments');
      const config = await pricing.get();
      const registration = registrationFor(input.registration);
      const history = await memberships.list({ memberId });
      return repository.mutate((payments) => {
        // Idempotency: a repeated request returns the payment it already created and writes nothing. This
        // runs before the already-paid check, because that payment is what settled the concepts.
        const previous = requestId === undefined ? undefined : payments.find((payment) => payment.requestId === requestId && !payment.annulment);
        if (previous) {
          if (previous.memberId !== memberId || !sameConcepts(previous, concepts)) {
            throw new ConflictError('Request id was already used for a different payment');
          }
          return { payments, result: previous };
        }
        const settled = settledKeys(payments, memberId);
        const alreadyPaid = concepts.map(conceptKey).filter((key) => settled.has(key));
        if (alreadyPaid.length > 0) throw new ConflictError(`Already paid: ${alreadyPaid.join(', ')}`);
        const { owed, standing } = standingFor(member, history, payments, config);
        if (registration) assertEnrollmentOpen(payments, memberId, standing);
        assertOffered(concepts, member, history, payments, config, owed, standing);
        const charge = chargeFor(config, concepts, registration, standing === 'up_to_date');
        // Annulled payments stay in the list, so the maximum never goes back and numbers are never reused.
        const receiptNumber = payments.reduce((highest, payment) => Math.max(highest, payment.receiptNumber), 0) + 1;
        const payment: Payment = {
          id: randomUUID(),
          receiptNumber,
          memberId,
          method: input.method,
          paymentDate: today(),
          lines: charge.lines,
          total: charge.total,
          ...(registration ? { registration } : {}),
          createdBy: actor,
          createdAt: now().toISOString(),
          ...(requestId === undefined ? {} : { requestId }),
        };
        return { payments: [...payments, payment], result: payment };
      });
    },

    // Who may annul is enforced by the route; this records the reason, the actor and the date.
    async annul(paymentId: string, reason: string, actorId: string): Promise<Payment> {
      const text = requireText(reason, 'reason', MAX_REASON_LENGTH);
      const actor = requireText(actorId, 'actorId', 100);
      return repository.mutate((payments) => {
        const index = payments.findIndex((payment) => payment.id === paymentId);
        if (index === -1) throw new NotFoundError('Payment not found');
        const current = payments[index]!;
        if (current.annulment) throw new ConflictError('Payment is already annulled');
        const annulled: Payment = {
          ...current,
          annulment: { reason: text, annulledBy: actor, annulledAt: now().toISOString() },
        };
        return { payments: payments.map((payment, position) => (position === index ? annulled : payment)), result: annulled };
      });
    },

    // A number looks up by receipt number, a string by payment id.
    getReceipt(ref: number | string): Promise<Payment> {
      return findPayment((payment) => (typeof ref === 'number' ? payment.receiptNumber === ref : payment.id === ref));
    },

    async history(memberId: string): Promise<Payment[]> {
      await members.getById(memberId);
      return (await repository.list())
        .filter((payment) => payment.memberId === memberId)
        .sort((a, b) => a.receiptNumber - b.receiptNumber);
    },

    async account(memberId: string): Promise<MemberAccount> {
      const member = await members.getById(memberId);
      const [history, payments, config] = await Promise.all([
        memberships.list({ memberId }),
        repository.list(),
        pricing.get(),
      ]);
      const asOf = today();
      const { owed, standing } = standingFor(member, history, payments, config);
      const advance = standing === 'up_to_date' && member.status === 'active' ? advanceOffer(member, history, payments, config, asOf) : undefined;
      return {
        memberId,
        asOf,
        standing,
        unpaidPeriodCount: owed.length,
        owed,
        enrollmentAvailable: enrollmentOpen(payments, memberId, standing),
        ...(advance ? { advance } : {}),
      };
    },
  };
}

export type PaymentService = ReturnType<typeof createPaymentService>;
