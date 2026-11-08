/** Mirrors `GreetingEvent` in backend/src/modules/access/greeting.bus.ts, after the parser has checked every field. */
export type GreetingTone = 'welcome' | 'see_desk' | 'refused';
export type EntranceKind = 'up_to_date' | 'debtor' | 'deregistered' | 'inactive' | 'not_recognized' | 'not_found';
export type EntranceMethod = 'dni' | 'face';

/** A member who was identified; the id and number let the staff screen load the rest through the members API. */
export interface GreetingMember {
  id: string;
  memberNumber: string;
  fullName: string;
  firstName: string;
  /** Discipline names; empty when there are none. */
  disciplines: string[];
}

export interface GreetingEvent {
  /** ISO instant of the check. */
  at: string;
  tone: GreetingTone;
  /** Only with welcome and see_desk. */
  firstName?: string;
  kind: EntranceKind;
  method: EntranceMethod;
  /** Only when a member was identified. */
  member?: GreetingMember;
  /** Up to date members: last paid month, YYYY-MM. */
  paidThrough?: string;
  /** Up to date members: last day to pay the next month without surcharge, YYYY-MM-DD. */
  dueDate?: string;
  /** Debtors and deregistered members: oldest unpaid month, YYYY-MM. */
  debtSince?: string;
  unpaidPeriodCount?: number;
}
