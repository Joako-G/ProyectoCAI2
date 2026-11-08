/** Mirrors `GreetingEvent` in backend/src/modules/access/greeting.bus.ts: all the public display ever receives. */
export type GreetingTone = 'welcome' | 'see_desk' | 'refused';

export interface GreetingEvent {
  /** ISO instant of the check. */
  at: string;
  tone: GreetingTone;
  /** Only with welcome and see_desk. */
  firstName?: string;
}
